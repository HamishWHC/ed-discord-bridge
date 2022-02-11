import json
import os

import boto3

from update_messages import update_messages

ED_TOKEN = None
DISCORD_WEBHOOK_URL = None


def handler(_event, _context):
    global ED_TOKEN
    global DISCORD_WEBHOOK_URL

    secret_arn = os.environ["SECRET_ARN"]
    courses = json.loads(os.environ["COURSES"])
    threads_table_name = os.environ["TABLE_NAME"]

    if ED_TOKEN is None or DISCORD_WEBHOOK_URL is None:
        sm_client = boto3.client('secretsmanager')
        
        secret = json.loads(sm_client.get_secret_value(SecretId=secret_arn)["SecretString"])
        ED_TOKEN = secret["ed_token"]
        DISCORD_WEBHOOK_URL = secret["discord_webhook_url"]

    update_messages(courses, threads_table_name, ED_TOKEN, DISCORD_WEBHOOK_URL)
