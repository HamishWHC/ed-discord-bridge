#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { EdDiscordBridgeStack } from '../lib/ed-discord-bridge-stack';

const app = new cdk.App();
new EdDiscordBridgeStack(app, 'EdDiscordBridgeStack');
