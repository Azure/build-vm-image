import TaskParameters from './TaskParameters';
import { IAuthorizer } from 'azure-actions-webclient/Authorizer/IAuthorizer';
import { WebRequest, WebResponse } from 'azure-actions-webclient/WebClient';
import { ServiceClient as AzureRestClient, ToError, AzureError } from 'azure-actions-webclient/AzureRestClient';
import * as core from '@actions/core';

var apiVersion = "2020-02-14";

export default class ImageBuilderClient {

    private _client: AzureRestClient;
    private _taskParameters: TaskParameters;
    private _template_run_complete: boolean;

    constructor(resourceAuthorizer: IAuthorizer, taskParameters: TaskParameters) {
        this._client = new AzureRestClient(resourceAuthorizer);
        this._taskParameters = taskParameters;
        this._template_run_complete = false;
    }
    public getTemplateRunComplete(): boolean {
        return this._template_run_complete 
    }

    public async getTemplateId(templateName: string, subscriptionId: string): Promise<string> {
        let httpRequest: WebRequest = {
            method: 'GET',
            uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
        };
        var resourceId: string = "";
        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200 || response.body.status == "Failed")
                throw ToError(response);

            if (response.statusCode == 200 && response.body.id)
                resourceId = response.body.id;
        }
        catch (error) {
            throw Error(`Get template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
        }
        return resourceId;
    }

    public async putImageTemplate(template: string, templateName: string, subscriptionId: string) {
        console.log("Submitting the template");
        let httpRequest: WebRequest = {
            method: 'PUT',
            uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion),
            body: template
        };

        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode == 201) {
                response = await this.getLongRunningOperationResult('putImageTemplate', response);
            }
            if (response.statusCode != 200 || response.body.status == "Failed") {
                throw ToError(response);
            }
            if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                console.log("Submitted template: \n", response.body.status);
            }
        }
        catch (error) {
            throw Error(`Submit template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
        }
    }
    public async getRunTemplate(templateName: string, subscriptionId: string){
        try {
            let httpRequest = {
                method: 'GET',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
            };
            var response = await this._client.beginRequest(httpRequest);

            if (response.statusCode == 202) {
                response = await this.getLongRunningOperationResult('getRunTemplate', response);
            }
            if (response.statusCode != 200 || response.body.status == "Failed") {
                throw ToError(response);
            }
            if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                console.log("Run template: \n", response.body.status);
            }
            return response
        }
        catch (error) {
            throw Error(`Post template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
        }
    }
    public async runTemplate(templateName: string, subscriptionId: string,timeOutInMinutes: number) {
        try {
            console.log("Starting run template...");
            let httpRequest: WebRequest = {
                method: 'POST',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}/run`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
            };

            var response = await this._client.beginRequest(httpRequest);
            
            if (response.statusCode == 202) {
                if (this._taskParameters.actionRunMode == "nowait"){
                    console.log("Action Run Mode set to NoWait. Skipping wait\n");
                    return
                }
                response = await this.getLongRunningOperationResult('runTemplate', response, timeOutInMinutes, templateName, subscriptionId);
            }
            if (response.statusCode != 200 || response.body.status == "Failed") {
                throw ToError(response);
            }
            if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                console.log("Run template: \n", response.body.status);
            }
        }
        catch (error) {
            throw Error(`Post template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
        }
    }

    public async deleteTemplate(templateName: string, subscriptionId: string) {
        try {
            console.log(`Deleting template ${templateName}...`);
            let httpRequest: WebRequest = {
                method: 'DELETE',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
            };
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode == 202) {
                response = await this.getLongRunningOperationResult('deleteTemplate', response);
            }
            if (response.statusCode != 200 || response.body.status == "Failed") {
                throw ToError(response);
            }

            if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                console.log("Delete template: ", response.body.status);
            }
        }
        catch (error) {
            throw Error(`Delete template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
        }
    }


    public async getRunOutput(templateName: string, runOutput: string, subscriptionId: string): Promise<string> {
        if (!this._template_run_complete && this._taskParameters.actionRunMode != "full"){
            return ""
        }
        let httpRequest: WebRequest = {
            method: 'GET',
            uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}/runOutputs/{runOutput}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName, '{runOutput}': runOutput }, [], apiVersion)
        };
        var output: string = "";
        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200 || response.body.status == "Failed")
                throw ToError(response);
            if (response.statusCode == 200 && response.body) {
                if (response.body && response.body.properties.artifactId)
                    output = response.body.properties.artifactId;
                else if (response.body && response.body.properties.artifactUri)
                    output = response.body.properties.artifactUri;
                else
                    console.log(`Error in parsing response.body -- ${response.body}.`);
            }
        }
        catch (error) {
            throw Error(`Get runOutput call failed for template ${templateName} for ${runOutput} with error: ${JSON.stringify(error)}`);
        }
        return output;
    }

    public async getLongRunningOperationResult(action: string, response: WebResponse, timeoutInMinutes?: number, templateName: string = "", subscriptionId: string = ""): Promise<WebResponse> {
        var longRunningOperationRetryTimeout = !!timeoutInMinutes ? timeoutInMinutes : 0;
        timeoutInMinutes = timeoutInMinutes || longRunningOperationRetryTimeout;
        var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;
        var waitIndefinitely = timeoutInMinutes == 0;
        var requestURI = response.headers["azure-asyncoperation"] || response.headers["location"];
        let httpRequest: WebRequest = {
            method: 'GET',
            uri: requestURI
        };

        if (!httpRequest.uri) {
            console.log("error in uri " + httpRequest.uri);
            throw new Error("InvalidResponseLongRunningOperation");
        }
        
        while (true) {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode === 202 || (response.body && (response.body.status == "Accepted" || response.body.status == "Running" || response.body.status == "InProgress"))) {
                if (response.body && response.body.status) {
                    core.debug(response.body.status);
                }
                if (!waitIndefinitely && timeout < new Date().getTime()) {
                    throw Error(`error in url`);
                }
                if ( action == "runTemplate" &&  this._taskParameters.actionRunMode != "full" && (templateName && templateName != "") && (subscriptionId && subscriptionId != "") ) {
                    let runTemplate_result = null
                    if ( this._taskParameters.actionRunMode == "custom" ){
                        let running_time_minutes = Math.floor(((new Date()).getTime() - this._taskParameters.actionStartTime.getTime()) / 1000 / 60);

                        if ( running_time_minutes >= this._taskParameters.actionRunModeMinutes){                            
                            console.log(`Hit Max Action Runtime Minutes: ${this._taskParameters.actionRunModeMinutes}`)
                            runTemplate_result = await this.getRunTemplate(templateName, subscriptionId).then(result=> (runTemplate_result = result))

                            return runTemplate_result
                        }


                    }
                    if (this._taskParameters.actionRunMode == "buildonly" ) {
                        try{
                            
                            try{
                                runTemplate_result = await this.getRunTemplate(templateName, subscriptionId).then(result=> (runTemplate_result = result))

                                if (!runTemplate_result.body.properties && !runTemplate_result.body.properties.lastRunStatus){
                                    if (runTemplate_result.properties.lastRunStatus.runSubState.toLowerCase() == "distributing"){
                                        console.log("Template is distributing set to break")
                                        return runTemplate_result
                                    }
                                }
                            }
                            catch(err){
                                console.log(err)
                            }                            
                        }
                        catch(err){
                            console.log(err)
                        }
                    }
                }
                var sleepDuration = 15;
                await this.sleepFor(sleepDuration);
            } else {
                if (action == "runTemplate" && response.statusCode === 200){
                    this._template_run_complete = true
                }
                break;
            }
        }

        return response;
    }

    private sleepFor(sleepDurationInSeconds: any): Promise<any> {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, sleepDurationInSeconds * 1000);
        });
    }
}