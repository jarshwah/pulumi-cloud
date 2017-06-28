// Copyright 2016-2017, Pulumi Corporation.  All rights reserved.

/*tslint:disable*/
declare let require: any;
import * as platform from "@lumi/platform";

export interface Q {
    push(item: string, callback?: (err: any) => void): void;
}

export let q: (queue: platform.Queue) => Q = queue => {
    let aws = require("aws-sdk");
    let sns = new aws.SNS();
    return <Q>{
        push: (item: string, callback) => {
            return sns.publish({
                Message: item,
                TopicArn: (<any>queue).topic.id,
            }, callback);
        },
    }
}