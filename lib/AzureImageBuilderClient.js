"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const AzureRestClient_1 = require("azure-actions-webclient/AzureRestClient");
const core = __importStar(require("@actions/core"));
var apiVersion = "2020-02-14";
class ImageBuilderClient {
    constructor(resourceAuthorizer, taskParameters) {
        this._client = new AzureRestClient_1.ServiceClient(resourceAuthorizer);
        this._taskParameters = taskParameters;
    }
    getTemplateId(templateName, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let httpRequest = {
                method: 'GET',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
            };
            var resourceId = "";
            try {
                var response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode != 200 || response.body.status == "Failed")
                    throw AzureRestClient_1.ToError(response);
                if (response.statusCode == 200 && response.body.id)
                    resourceId = response.body.id;
            }
            catch (error) {
                throw Error(`Get template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
            }
            return resourceId;
        });
    }
    putImageTemplate(template, templateName, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("Submitting the template");
            let httpRequest = {
                method: 'PUT',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion),
                body: template
            };
            try {
                var response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode == 201) {
                    response = yield this.getLongRunningOperationResult(response);
                }
                if (response.statusCode != 200 || response.body.status == "Failed") {
                    throw AzureRestClient_1.ToError(response);
                }
                if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                    console.log("Submitted template: \n", response.body.status);
                }
            }
            catch (error) {
                throw Error(`Submit template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
            }
        });
    }
    getRunTemplate(templateName, subscriptionId){
        var response;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let httpRequest = {
                    method: 'GET',
                    uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
                };
                response = yield this._client.beginRequest(httpRequest);

                if (response.statusCode == 202) {
                    response = yield this.getLongRunningOperationResult(response);
                }
                if (response.statusCode != 200 || response.body.status == "Failed") {
                    throw AzureRestClient_1.ToError(response);
                }
                if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                    console.log("Run template: \n", response.body.status);
                }
                return response
            }
            catch (error) {
                throw Error(`Post template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
            }
        });
    }
    runTemplate(templateName, subscriptionId, timeOutInMinutes) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Starting run template...");
                let httpRequest = {
                    method: 'POST',
                    uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}/run`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
                };
                var response = yield this._client.beginRequest(httpRequest);                

                if (response.statusCode == 202) {
                    if (this._taskParameters.actionRunMode == "nowait"){
                        console.log("Action Run Mode set to NoWait. Skipping wait\n");
                        return
                    }
                    response = yield this.getLongRunningOperationResult(response, timeOutInMinutes, templateName, subscriptionId);
                }
                if (response.statusCode != 200 || response.body.status == "Failed") {
                    throw AzureRestClient_1.ToError(response);
                }
                if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                    console.log("Run template: \n", response.body.status);
                }
            }
            catch (error) {
                throw Error(`Post template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
            }
        });
    }
    deleteTemplate(templateName, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(`Deleting template ${templateName}...`);
                let httpRequest = {
                    method: 'DELETE',
                    uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName }, [], apiVersion)
                };
                var response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode == 202) {
                    response = yield this.getLongRunningOperationResult(response);
                }
                if (response.statusCode != 200 || response.body.status == "Failed") {
                    throw AzureRestClient_1.ToError(response);
                }
                if (response.statusCode == 200 && response.body && response.body.status == "Succeeded") {
                    console.log("Delete template: ", response.body.status);
                }
            }
            catch (error) {
                throw Error(`Delete template call failed for template ${templateName} with error: ${JSON.stringify(error)}`);
            }
        });
    }
    getRunOutput(templateName, runOutput, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let httpRequest = {
                method: 'GET',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.VirtualMachineImages/imagetemplates/{imageTemplateName}/runOutputs/{runOutput}`, { '{subscriptionId}': subscriptionId, '{resourceGroupName}': this._taskParameters.resourceGroupName, '{imageTemplateName}': templateName, '{runOutput}': runOutput }, [], apiVersion)
            };
            var output = "";
            try {
                var response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode != 200 || response.body.status == "Failed")
                    throw AzureRestClient_1.ToError(response);
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
        });
    }
    getLongRunningOperationResult(response, timeoutInMinutes, templateName, subscriptionId) {
        var response;
        return __awaiter(this, void 0, void 0, function* () {
            var longRunningOperationRetryTimeout = !!timeoutInMinutes ? timeoutInMinutes : 0;
            timeoutInMinutes = timeoutInMinutes || longRunningOperationRetryTimeout;
            var timeout = new Date().getTime() + timeoutInMinutes * 60 * 1000;
            var waitIndefinitely = timeoutInMinutes == 0;
            var requestURI = response.headers["azure-asyncoperation"] || response.headers["location"];
            let httpRequest = {
                method: 'GET',
                uri: requestURI
            };

            if (!httpRequest.uri) {
                console.log("error in uri " + httpRequest.uri);
                throw new Error("InvalidResponseLongRunningOperation");
            }

            var sleepDuration = 15;
            while (true) {
                response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode === 202 || (response.body && (response.body.status == "Accepted" || response.body.status == "Running" || response.body.status == "InProgress"))) {
                    if (response.body && response.body.status) {
                        core.debug(response.body.status);
                    }
                    if (!waitIndefinitely && timeout < new Date().getTime()) {
                        console.log("getLongRunningOperationResult - awaiter 2")
                        throw Error(`error in url`);
                    }
                    if ( this._taskParameters.actionRunMode != "full" && templateName && subscriptionId ){
                        let runTemplate_result = null
                        if ( this._taskParameters.actionRunMode == "custom" ){
                            let running_time_minutes = Math.floor(((new Date()).getTime() - this._taskParameters.actionStartTime.getTime()) / 1000 / 60);

                            if ( running_time_minutes >= this._taskParameters.actionRunModeMinutes){
                                runTemplate_result = yield this.getRunTemplate(templateName, subscriptionId).then(result=> (runTemplate_result = result))
                                response = runTemplate_result

                                return response
                            }


                        }
                        if (this._taskParameters.actionRunMode == "buildonly"){
                            try{
                                
                                try{
                                    runTemplate_result = yield this.getRunTemplate(templateName, subscriptionId).then(result=> (runTemplate_result = result))

                                    if (!runTemplate_result.body.properties && !runTemplate_result.body.properties.lastRunStatus){
                                        if (runTemplate_result.properties.lastRunStatus.runSubState.toLowerCase() == "distributing"){
                                            console.log("Template is distributing set to break")
                                            response = runTemplate_result
                                            return response
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
                    
                    yield this.sleepFor(sleepDuration);
                }
                else {
                    break;
                }
            }
            return response;
        });
    }
    sleepFor(sleepDurationInSeconds) {
        return new Promise((resolve, reject) => {
            setTimeout(resolve, sleepDurationInSeconds * 1000);
        });
    }
}
exports.default = ImageBuilderClient;
