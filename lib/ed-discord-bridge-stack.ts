import {AttributeType, BillingMode, Table} from "@aws-cdk/aws-dynamodb"
import {Rule, Schedule} from "@aws-cdk/aws-events"
import {LambdaFunction} from "@aws-cdk/aws-events-targets"
import {Effect, PolicyStatement} from "@aws-cdk/aws-iam"
import {AssetCode, Function, Runtime} from "@aws-cdk/aws-lambda"
import * as cdk from '@aws-cdk/core'

export class EdDiscordBridgeStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const table = new Table(this, 'ThreadsTable', {
            partitionKey: {name: 'thread_id', type: AttributeType.NUMBER},
            billingMode: BillingMode.PAY_PER_REQUEST
        })

        const secretArn = this.node.tryGetContext("secretArn")

        const lambdaFn = new Function(this, "UpdateFn", {
            code: AssetCode.fromAsset("lambda", {
                bundling: {
                    image: Runtime.PYTHON_3_9.bundlingImage,
                    command: [
                        'bash', '-c',
                        'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
                    ],
                }
            }),
            runtime: Runtime.PYTHON_3_9,
            handler: "handler.handler",
            environment: {
                TABLE_NAME: table.tableName,
                COURSES: (this.node.tryGetContext("courses") as number[]).join(","),
                SECRET_ARN: secretArn
            },
            timeout: cdk.Duration.minutes(1),
            initialPolicy: [
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [secretArn],
                    actions: ["secretsmanager:GetSecretValue"]
                }),
                new PolicyStatement({
                    effect: Effect.ALLOW,
                    resources: [table.tableArn],
                    actions: [
                        "dynamodb:PutItem",
                        "dynamodb:Scan"
                    ]
                })
            ]
        })

        new Rule(this, "UpdateRule", {
            schedule: Schedule.rate(cdk.Duration.minutes(this.node.tryGetContext("updateFrequency"))),
            targets: [new LambdaFunction(lambdaFn)]
        })
    }
}
