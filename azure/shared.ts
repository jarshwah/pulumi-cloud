// Copyright 2016-2018, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as azure from "@pulumi/azure";
import * as pulumi from "@pulumi/pulumi";
import { RunError } from "@pulumi/pulumi/errors";

// nameWithStackInfo is the resource prefix we'll use for all resources we auto-provision.  In general,
// it's safe to use these for top-level components like Network and Cluster, because they suffix all
// internal resources they provision.
const nameWithStackInfo = `pulumi-${pulumi.getStack()}`;

export function createNameWithStackInfo(requiredInfo: string) {
    const maxLength = 24;

    if (requiredInfo.length > maxLength) {
        throw new RunError(`'${requiredInfo}' cannot be longer then ${maxLength} characters.`);
    }

    // No required portion.  Just return the stack name.
    if (requiredInfo.length === 0) {
        return nameWithStackInfo.substr(0, maxLength);
    }

    // Only enough room for required portion, don't add the stack.
    // Also don't add the stack if there wouldn't be room to add it and a dash.
    if (requiredInfo.length >= maxLength - "-".length) {
        return requiredInfo;
    }

    // Attempt to keep some portion of the stack, then - then the required part.
    const suffix = "-" + requiredInfo;
    const result = nameWithStackInfo.substr(0, maxLength - suffix.length) + suffix;
    return result;
}

// Expose a common infrastructure resource that all our global resources can consider themselves to
// be parented by.  This helps ensure unique URN naming for these guys as tey cannot conflict with
// any other user resource.
class InfrastructureResource extends pulumi.ComponentResource {
    constructor() {
        super("cloud:global:infrastructure", "global-infrastructure");
    }
}

let globalInfrastructureResource: InfrastructureResource | undefined;
export function getGlobalInfrastructureResource(): pulumi.Resource {
    if (!globalInfrastructureResource) {
        globalInfrastructureResource = new InfrastructureResource();
    }

    return globalInfrastructureResource;
}

const config = new pulumi.Config("cloud-azure");
export const resourceGroupName = config.require("resource-group-name");
export const location = config.require("location");

let globalResourceGroup: Promise<azure.core.ResourceGroup>;
export function getGlobalResourceGroup() {
    if (!globalResourceGroup) {
        globalResourceGroup = getGlobalResourceGroupWorker();
    }

    return globalResourceGroup;
}

async function getGlobalResourceGroupWorker() {
    const result = await azure.core.getResourceGroup({
        name: resourceGroupName,
    });

    return azure.core.ResourceGroup.get("global", result.id);
}

let globalStorageAccount: azure.storage.Account;
export function getGlobalStorageAccount() {
    if (!globalStorageAccount) {
        globalStorageAccount = getOrCreateGlobalStorageAccount();
    }

    return globalStorageAccount;
}

function getOrCreateGlobalStorageAccount(): azure.storage.Account {
    const storageAccountId = config.get("storage-account-id");
    if (storageAccountId) {
        return azure.storage.Account.get("global", storageAccountId);
    }

    return new azure.storage.Account("global", {
        resourceGroupName: resourceGroupName,
        location: location,
        accountKind: "StorageV2",
        accountTier: "Standard",
        accountReplicationType: "LRS",
    }, { parent: getGlobalInfrastructureResource() });
}