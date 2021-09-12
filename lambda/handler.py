import json
import os

import boto3

from update_messages import update_messages


def handler(_event, _context):
    secret_arn = os.environ["SECRET_ARN"]
    courses = [int(c.strip()) for c in os.environ["COURSES"].split(",")]
    threads_table_name = os.environ["TABLE_NAME"]

    sm_client = boto3.client('secretsmanager')
    
    secrets = json.loads(sm_client.get_secret_value(SecretId=secret_arn)["SecretString"])
    ed_token = secrets["ed_token"]
    discord_webhook_url = secrets["discord_webhook_url"]

    update_messages(courses, threads_table_name, ed_token, discord_webhook_url)
