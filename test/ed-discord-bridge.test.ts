import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as EdDiscordBridge from '../lib/ed-discord-bridge-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new EdDiscordBridge.EdDiscordBridgeStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
