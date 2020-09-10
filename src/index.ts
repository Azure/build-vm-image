import ImageBuilder from './ImageBuilder';
import { AuthorizerFactory } from "azure-actions-webclient/AuthorizerFactory";
import * as core from '@actions/core';

async function main(): Promise<void> {
    let azureResourceAuthorizer = await AuthorizerFactory.getAuthorizer();
    var ib = new ImageBuilder(azureResourceAuthorizer);
    await ib.execute();
}

main().then()
    .catch((error) => {
        console.log("$(imagebuilder-run-status) = ", "failed");
        core.setOutput('imagebuilder-run-status', "failed");
        core.error(error);
        core.setFailed("Action run failed.");
    });