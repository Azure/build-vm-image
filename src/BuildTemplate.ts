"use strict";
import path = require("path");
import TaskParameters from "./TaskParameters";
import Utils, { getCurrentTime } from "./Utils";
import { IAuthorizer } from 'azure-actions-webclient/Authorizer/IAuthorizer';
import { WebRequest } from 'azure-actions-webclient/WebClient';
import { ServiceClient as AzureRestClient, ToError, AzureError } from 'azure-actions-webclient/AzureRestClient';

var defaultTemplate = `
{
    "location": "",
    "identity": {
        "type": "UserAssigned",
          "userAssignedIdentities": {
            "IDENTITY": {}
          }
    },
    "properties": {
      "source": SOURCE,
      "customize": [CUSTOMIZE],
      "distribute": [DISTRIBUTE],
      "vmProfile": {
        "vmSize": "VM_SIZE"
        }
    }
  }
`
var templateSource = new Map([
    ["managedimage", `{"type": "ManagedImage", "imageId": "IMAGE_ID"}`],
    ["sharedimagegallery", `{"type": "SharedImageVersion", "imageVersionId": "IMAGE_ID"}`],
    ["platformimage", `{"type": "PlatformImage", "publisher": "PUBLISHER_NAME", "offer": "OFFER_NAME","sku": "SKU_NAME", "version": "VERSION"}`]
])

var templateCustomizer = new Map([
    ["shell", `{"type": "File", "name": "aibaction_file_copy", "sourceUri": "", "destination": ""},{"type": "Shell", "name": "aibaction_inline", "inline":[]}`],
    ["shellInline", `{"type": "Shell", "name": "aibaction_inline", "inline":[]}`],
    ["powershell", `{"type": "PowerShell", "name": "aibaction_inline", "inline":[]}`],
    ["windowsUpdate", `{"type": "PowerShell", "name": "5minWait_is_needed_before_windowsUpdate", "inline":["Start-Sleep -Seconds 300"]},{"type": "WindowsUpdate", "searchCriteria": "IsInstalled=0", "filters": ["exclude:$_.Title -like '*Preview*'", "include:$true"]}`]
])

var templateDistribute = new Map([
    ["managedimage", `{"type": "ManagedImage", "imageId": "IMAGE_ID", "location": "", "runOutputName": "ManagedImage_distribute", "artifactTags": {"RunURL": "URL", "GitHubRepo": "GITHUB_REPO", "GithubCommit": "GITHUB_COMMIT"}}`],
    ["sharedimagegallery", `{"type": "SharedImage", "galleryImageId": "IMAGE_ID", "replicationRegions": [], "runOutputName": "SharedImage_distribute", "artifactTags": {"RunURL": "URL", "GitHubRepo": "GITHUB_REPO", "GithubCommit": "GITHUB_COMMIT"}}`],
    ["vhd", `{"type": "VHD", "runOutputName": "VHD_distribute"}`]
])

export default class BuildTemplate {
    private _taskParameters: TaskParameters;
    private _client: AzureRestClient;

    constructor(resourceAuthorizer: IAuthorizer, taskParameters: TaskParameters) {
        try {
            this._taskParameters = taskParameters;
            this._client = new AzureRestClient(resourceAuthorizer);
        }
        catch (error) {
            throw Error(error);
        }
    }

    private async getLatestVersion(subscriptionId: string): Promise<string> {
        let httpRequest: WebRequest = {
            method: 'GET',
            uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/providers/Microsoft.Compute/locations/{location}/publishers/{publisherName}/artifacttypes/vmimage/offers/{offer}/skus/{skus}/versions`, { '{subscriptionId}': subscriptionId, '{location}': this._taskParameters.location, '{publisherName}': this._taskParameters.imagePublisher, '{offer}': this._taskParameters.imageOffer, '{skus}': this._taskParameters.imageSku }, ["$orderby=name%20desc", "$top=1"], '2018-06-01')
        };
        var latestVersion: string = "";
        try {
            var response = await this._client.beginRequest(httpRequest);
            if (response.statusCode != 200 || response.body.statusCode == "Failed") {
                throw Error(response.statusCode.toString());
            }
            if (response.statusCode == 200 && response.body)
                latestVersion = response.body[0].name;
        }
        catch (error) {
            throw Error(`failed to get latest image version: request uri ${httpRequest.uri}: ${error}`);
        }
        return latestVersion;
    }

    public async getTemplate(blobUrl: string, imgBuilderId: string, subscriptionId: string): Promise<any> {
        var template = defaultTemplate;
        template = template.replace("IDENTITY", imgBuilderId);
        template = template.replace("VM_SIZE", this._taskParameters.vmSize);
        template = template.replace("SOURCE", <string>templateSource.get(this._taskParameters.sourceImageType.toLowerCase()));
        template = template.replace("DISTRIBUTE", <string>templateDistribute.get(this._taskParameters.distributeType.toLowerCase()));
        var customizers: any;
        if (Utils.IsEqual(this._taskParameters.provisioner, "shell") && (this._taskParameters.customizerSource == undefined || this._taskParameters.customizerSource.length == 0)) {
            customizers = templateCustomizer.get("shellInline");
        }
        else {
            customizers = templateCustomizer.get(this._taskParameters.provisioner);
        }
        if (Utils.IsEqual(this._taskParameters.provisioner, "powershell") && this._taskParameters.windowsUpdateProvisioner)
            customizers = customizers + "," + templateCustomizer.get("windowsUpdate");
        template = template.replace("CUSTOMIZE", <string>customizers);

        var templateJson = JSON.parse(template);
        templateJson.location = this._taskParameters.location;
        if (Utils.IsEqual(templateJson.properties.source.type, "PlatformImage")) {
            templateJson.properties.source.publisher = this._taskParameters.imagePublisher;
            templateJson.properties.source.offer = this._taskParameters.imageOffer;
            templateJson.properties.source.sku = this._taskParameters.imageSku;
            if (Utils.IsEqual(this._taskParameters.baseImageVersion, "latest"))
                templateJson.properties.source.version = await this.getLatestVersion(subscriptionId);
            else
                templateJson.properties.source.version = this._taskParameters.baseImageVersion
        }
        else if (Utils.IsEqual(templateJson.properties.source.type, "ManagedImage"))
            templateJson.properties.source.imageId = this._taskParameters.sourceResourceId;
        else
            templateJson.properties.source.imageVersionId = this._taskParameters.imageVersionId;

        // customize
        if (Utils.IsEqual(this._taskParameters.provisioner, "shell")) {
            var inline: string = "#\n";
            if (!(this._taskParameters.buildFolder == "")) {
                var packageName = `/tmp/${this._taskParameters.buildFolder}`;
                templateJson.properties.customize[0].sourceUri = blobUrl;
                templateJson.properties.customize[0].destination = `${packageName}.tar.gz`;
                inline += `mkdir -p ${packageName}\n`
                inline += `sudo tar -xzvf ${templateJson.properties.customize[0].destination} -C ${packageName}\n`
                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                templateJson.properties.customize[1].inline = inline.split("\n");
            }
            else {
                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                templateJson.properties.customize[0].inline = inline.split("\n");
            }
        }
        else if (Utils.IsEqual(this._taskParameters.provisioner, "powershell")) {
            var inline = "";
            if (!(this._taskParameters.buildFolder == "")) {
                var packageName = "c:\\" + this._taskParameters.buildFolder;
                inline += `Invoke-WebRequest -Uri '${blobUrl}' -OutFile ${packageName}.zip -UseBasicParsing\n`
                inline += `Expand-Archive -Path ${packageName}.zip -DestinationPath ${packageName}\n`
            }

            if (this._taskParameters.inlineScript)
                inline += `${this._taskParameters.inlineScript}\n`;
            templateJson.properties.customize[0].inline = inline.split("\n");
        }

        if (Utils.IsEqual(templateJson.properties.distribute[0].type, "ManagedImage")) {
            if (this._taskParameters.imageIdForDistribute == "" || this._taskParameters.imageIdForDistribute == undefined) {
                var imageDefn = "mi_" + getCurrentTime();
                templateJson.properties.distribute[0].imageId = `/subscriptions/${subscriptionId}/resourceGroups/${this._taskParameters.resourceGroupName}/providers/Microsoft.Compute/images/${imageDefn}`;
            }
            else {
                templateJson.properties.distribute[0].imageId = this._taskParameters.imageIdForDistribute;
            }
            templateJson.properties.distribute[0].location = this._taskParameters.managedImageLocation;
        }

        if (Utils.IsEqual(templateJson.properties.distribute[0].type, "SharedImage")) {
            templateJson.properties.distribute[0].galleryImageId = this._taskParameters.galleryImageId;
            var regions = this._taskParameters.replicationRegions.split(",");
            templateJson.properties.distribute[0].replicationRegions = regions;
        }
        if (Utils.IsEqual(templateJson.properties.distribute[0].type, "SharedImage") || Utils.IsEqual(templateJson.properties.distribute[0].type, "ManagedImage")) {
            templateJson.properties.distribute[0].artifactTags.RunURL = process.env.GITHUB_SERVER_URL + "/" + process.env.GITHUB_REPOSITORY + "/actions/runs/" + process.env.GITHUB_RUN_ID;
            templateJson.properties.distribute[0].artifactTags.GitHubRepo = process.env.GITHUB_REPOSITORY;
            templateJson.properties.distribute[0].artifactTags.GithubCommit = process.env.GITHUB_SHA;
            if (this._taskParameters.distImageTags !== "" && this._taskParameters.distImageTags !== undefined) {
                var distImageTags = this._taskParameters.distImageTags.split(",");
                for (var i = 0; i < distImageTags.length; i++) {
                    var distImageTag = distImageTags[i].split(":");
                    templateJson.properties.distribute[0].artifactTags[distImageTag[0]] = distImageTag[1];
                }
            }
        }

        return templateJson;
    }

    public addUserCustomisationIfNeeded(blobUrl: string): any {
        let json: any = JSON.parse(this._taskParameters.templateJsonFromUser);
        let customizers: any = json.properties.customize;

        // add customization for custom source
        let fileCustomizer: any;
        if (!!this._taskParameters.customizerSource) {
            let windowsUpdateCustomizer: any;
            if (Utils.IsEqual(this._taskParameters.provisioner, "powershell") && this._taskParameters.windowsUpdateProvisioner) {
                windowsUpdateCustomizer = JSON.parse("[" + <string>templateCustomizer.get("windowsUpdate") + "]");
                for (var i = windowsUpdateCustomizer.length - 1; i >= 0; i--) {
                    customizers.unshift(windowsUpdateCustomizer[i]);
                }
            }
            fileCustomizer = JSON.parse("[" + <string>templateCustomizer.get(this._taskParameters.provisioner) + "]");
            for (var i = fileCustomizer.length - 1; i >= 0; i--) {
                customizers.unshift(fileCustomizer[i]);
            }

            json.properties.customize = customizers;
            if (Utils.IsEqual(this._taskParameters.provisioner, "shell")) {
                var inline: string = "#\n";
                if (!(this._taskParameters.buildFolder == "")) {
                    var packageName = `/tmp/${this._taskParameters.buildFolder}`;
                    json.properties.customize[0].sourceUri = blobUrl;
                    json.properties.customize[0].destination = `${packageName}.tar.gz`;
                    inline += `mkdir -p ${packageName}\n`
                    inline += `sudo tar -xzvf ${json.properties.customize[0].destination} -C ${packageName}\n`
                }

                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                json.properties.customize[1].inline = inline.split("\n");
            } else if (Utils.IsEqual(this._taskParameters.provisioner, "powershell")) {
                var inline = "";
                if (!(this._taskParameters.buildFolder == "")) {
                    var packageName = "c:\\" + this._taskParameters.buildFolder;
                    inline += `Invoke-WebRequest -Uri '${blobUrl}' -OutFile ${packageName}.zip -UseBasicParsing\n`
                    inline += `Expand-Archive -Path ${packageName}.zip -DestinationPath ${packageName}\n`
                }

                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                json.properties.customize[0].inline = inline.split("\n");
            }
        }

        json.properties.customize = customizers;
        return json;
    }
}