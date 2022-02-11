import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb"
import {Rule, Schedule} from "aws-cdk-lib/aws-events"
import {LambdaFunction} from "aws-cdk-lib/aws-events-targets"
import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam"
import {AssetCode, Function, Runtime} from "aws-cdk-lib/aws-lambda"
import {Secret} from "aws-cdk-lib/aws-secretsmanager"
import * as cdk from 'aws-cdk-lib'
import {Construct} from "constructs"

export class EdDiscordBridgeStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const table = new Table(this, 'ThreadsTable', {
            partitionKey: {name: 'thread_id', type: AttributeType.NUMBER},
            billingMode: BillingMode.PAY_PER_REQUEST
        })

        const secretArn = this.node.tryGetContext("secretArn")
        const secret = Secret.fromSecretCompleteArn(this, 'Secret', secretArn)

        const code = AssetCode.fromAsset("lambda", {
            bundling: {
                image: Runtime.PYTHON_3_9.bundlingImage,
                command: [
                    'bash', '-c',
                    'pip install -r requirements.txt -t /asset-output && cp -au . /asset-output'
                ],
            }
        })

        const rotationFn = new Function(this, "RotationFunction", {
            code,
            runtime: Runtime.PYTHON_3_9,
            handler: "rotator.lambda_handler",
            timeout: cdk.Duration.seconds(15)
        })

        const rotationSchedule = secret.addRotationSchedule('Rotation', {
            rotationLambda: rotationFn,
            automaticallyAfter: cdk.Duration.days(6)
        })

        rotationSchedule.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

        const lambdaFn = new Function(this, "UpdateFn", {
            code,
            runtime: Runtime.PYTHON_3_9,
            handler: "handler.handler",
            environment: {
                TABLE_NAME: table.tableName,
                COURSES: JSON.stringify(this.node.tryGetContext("courses")),
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
