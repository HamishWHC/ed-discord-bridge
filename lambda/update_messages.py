import json
import os

import boto3
import requests

ED_BASE_URL = "https://edstem.org"
ED_API_URL = ED_BASE_URL + "/api"
THREAD_URL = ED_BASE_URL + "/courses/{course_id}/discussion/{thread_id}"
THREADS_API_URL = ED_API_URL + "/courses/{course_id}/threads"
MSG_COMPARISON_KEYS = [
    "course_id",
    "title",
    "document",
    "type",
    "category",
    "vote_count",
    "view_count",
    "reply_count",
    "is_answered",
    "is_anonymous"
]


def find(iterable, predicate):
    for item in iterable:
        if predicate(item):
            return item
    return None


def smart_truncate(content, length=250, suffix='...'):
    if len(content) <= length:
        return content
    else:
        return ' '.join(content[:length+1].split(' ')[0:-1]) + suffix


def make_discord_msg(thread, username):
    msg = {
        "username": username,
        "embeds": [
            {
                "title": thread["title"],
                "description": smart_truncate(thread["document"]),
                "url": THREAD_URL.format(course_id=thread["course_id"], thread_id=thread["id"]),
                "color": 5253260,
                "timestamp": thread["created_at"],
                "footer": {
                    "text": "ed-Discord Bridge by HamishWHC"
                },
                "author": {
                    "name": f"{thread['user']['name']} [{thread['user']['course_role'].capitalize()}]" if not thread["is_anonymous"] else "Anonymous"
                },
                "fields": [
                    {
                        "name": "Type",
                        "value": thread["type"].capitalize(),
                        "inline": True
                    },
                    {
                        "name": "Category",
                        "value": thread["category"],
                        "inline": True
                    },
                    {
                        "name": "Votes",
                        "value": f"{thread['vote_count']}",
                        "inline": True
                    },
                    {
                        "name": "Views",
                        "value": f"{thread['view_count']}",
                        "inline": True
                    },
                    {
                        "name": "Replies",
                        "value": f"{thread['reply_count']}",
                        "inline": True
                    }
                ]
            }
        ]
    }

    if thread["type"] == "question":
        msg["embeds"][0]["fields"].append({
            "name": "Answered",
            "value": "Yes" if thread["is_answered"] else "No",
            "inline": True
        })
    
    return msg


def update_messages(courses, threads_table_name, ed_token, discord_webhook_url):
    dynamodb = boto3.resource("dynamodb")
    threads_table = dynamodb.Table(threads_table_name)

    courses_data = requests.get(
        ED_API_URL + "/user", headers={"X-Token": ed_token}).json()["courses"]

    threads = []
    for course in courses:
        thread_data = requests.get(THREADS_API_URL.format(course_id=course["id"]), params={
                                   "limit": 100, "sort": "new"}, headers={"X-Token": ed_token}).json()

        for thread in thread_data["threads"]:
            if thread["is_private"] and not course["include_private"]:
                continue

            threads.append(thread)

    threads.sort(key=lambda t: t["created_at"])

    thread_metas = threads_table.scan()["Items"]

    for thread in threads:
        thread_meta = find(
            thread_metas, lambda t: t["thread_id"] == thread["id"])

        course = find(courses_data, lambda c: c["course"]["id"] == thread["course_id"])[
            "course"]
        msg = make_discord_msg(thread, f"{course['code']}: {course['name']}")

        if thread_meta is not None:
            actual = {key: thread.get(key, None) for key in MSG_COMPARISON_KEYS}
            stored = {key: thread_meta.get(key, None) for key in MSG_COMPARISON_KEYS}

            if actual == stored:
                continue

            msg = requests.patch(
                discord_webhook_url + f"/messages/{thread_meta['discord_message_id']}", json=msg, params={"wait": True}).json()
        else:
            msg = requests.post(discord_webhook_url, json=msg,
                                params={"wait": True}).json()

        threads_table.put_item(
            Item={
                "thread_id": thread["id"],
                "discord_message_id": msg["id"]
            } | {key: thread[key] for key in MSG_COMPARISON_KEYS}
        )


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()

    update_messages(
        json.loads(os.environ["COURSES"]),
        os.environ["TABLE_NAME"],
        os.environ["ED_TOKEN"],
        os.environ["DISCORD_WEBHOOK_URL"]
    )
