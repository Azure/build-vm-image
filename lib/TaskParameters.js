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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const tl = __importStar(require("@actions/core"));
const constants = __importStar(require("./constants"));
const Utils_1 = __importDefault(require("./Utils"));
var fs = require('fs');
class TaskParameters {
    constructor() {
        // action inputs
        var actionRunModeOptions = ["full", "buildonly", "nowait", "custom"]
        this.actionRunMode = ""
        this.actionRunModeMinutes = 30
        this.actionStartTime = new Date()
        // image builder inputs
        this.resourceGroupName = "";
        this.location = "";
        this.isTemplateJsonProvided = false;
        this.templateJsonFromUser = '';
        this.buildTimeoutInMinutes = 240;
        this.vmSize = "";
        this.managedIdentity = "";
        // source
        this.sourceImageType = "";
        this.sourceOSType = "";
        this.sourceResourceId = "";
        this.imageVersionId = "";
        this.baseImageVersion = "";
        this.imagePublisher = "";
        this.imageOffer = "";
        this.imageSku = "";
        //customize
        this.buildPath = "";
        this.buildFolder = "";
        this.blobName = "";
        this.provisioner = "";
        this.customizerSource = "";
        this.customizerScript = "";
        this.customizerWindowsUpdate = "";
        //distribute
        this.distributeType = "";
        this.imageIdForDistribute = "";
        this.replicationRegions = "";
        this.managedImageLocation = "";
        this.galleryImageId = "";
        this.distImageTags = "";
        var locations = ["eastus", "eastus2", "westcentralus", "westus", "westus2", "southcentralus", "northeurope", "westeurope", "southeastasia", "australiasoutheast", "australia", "uksouth", "ukwest" ];
        console.log("start reading task parameters...");
        
        this.actionRunMode = tl.getInput(constants.ActionRunMode).toLowerCase();
        if (!this.actionRunMode){
            this.actionRunMode = "full"
        }        
        if (!(actionRunModeOptions.indexOf(this.actionRunMode) > -1)) {
            throw new Error("action run mode not from available options: full, buildonly, nowait, custom");
        }

        this.actionRunModeMinutes = parseInt(tl.getInput(constants.ActionRunModeTimeMinutes));
        if ( this.actionRunMode == "custom" && this.actionRunModeMinutes == 0 ){
            console.log(`Action run mode set to full, custom minutes was set as 0"`)
            this.actionRunMode = "full"
        }

        console.log(`Action run mode set: ${this.actionRunMode}`)
        if (this.actionRunMode == "custom"){
            console.log(`Action run mode time set: ${this.actionRunModeMinutes}`)
        }

        this.imagebuilderTemplateName = tl.getInput(constants.ImageBuilderTemplateName);
        if (this.imagebuilderTemplateName.indexOf(".json") > -1) {
            this.isTemplateJsonProvided = true;
            var data = fs.readFileSync(this.imagebuilderTemplateName, 'utf8');
            this.templateJsonFromUser = JSON.parse(JSON.stringify(data));
        }
        this.resourceGroupName = tl.getInput(constants.ResourceGroupName, { required: true });
        this.buildTimeoutInMinutes = parseInt(tl.getInput(constants.BuildTimeoutInMinutes));
        this.sourceOSType = tl.getInput(constants.SourceOSType, { required: true });
        if (Utils_1.default.IsEqual(this.sourceOSType, "windows")) {
            this.provisioner = "powershell";
        }
        else {
            this.provisioner = "shell";
        }
        if (!this.isTemplateJsonProvided) {
            //general inputs
            this.location = tl.getInput(constants.Location, { required: true });
            if (!(locations.indexOf(this.location.toString().replace(/\s/g, "").toLowerCase()) > -1)) {
                throw new Error("location not from available regions or it is not defined");
            }
            this.managedIdentity = tl.getInput(constants.ManagedIdentity, { required: true });
            //vm size
            this.vmSize = tl.getInput(constants.VMSize);
            //source inputs
            this.sourceImageType = tl.getInput(constants.SourceImageType);
            var sourceImage = tl.getInput(constants.SourceImage, { required: true });
            if (Utils_1.default.IsEqual(this.sourceImageType, constants.platformImageSourceTypeImage) || Utils_1.default.IsEqual(this.sourceImageType, constants.marketPlaceSourceTypeImage)) {
                this.sourceImageType = constants.platformImageSourceTypeImage;
                this._extractImageDetails(sourceImage);
            }
            else if (Utils_1.default.IsEqual(this.sourceImageType, constants.managedImageSourceTypeImage)) {
                this.sourceResourceId = sourceImage;
            }
            else {
                this.imageVersionId = sourceImage;
            }
        }
        //customize inputs
        this.customizerSource = tl.getInput(constants.CustomizerSource).toString();
        if (this.customizerSource == undefined || this.customizerSource == "" || this.customizerSource == null) {
            var artifactsPath = path.join(`${process.env.GITHUB_WORKSPACE}`, "workflow-artifacts");
            if (fs.existsSync(artifactsPath)) {
                this.customizerSource = artifactsPath;
            }
        }
        if (!(this.customizerSource == undefined || this.customizerSource == '' || this.customizerSource == null)) {
            var bp = this.customizerSource;
            var x = bp.split(path.sep);
            this.buildFolder = x[x.length - 1].split(".")[0];
            this.buildPath = path.normalize(bp.trim());
            console.log("Customizer source: " + this.customizerSource);
            console.log("Artifacts folder: " + this.buildFolder);
        }
        this.customizerScript = tl.getInput(constants.customizerScript).toString();
        this.inlineScript = tl.getInput(constants.customizerScript);
        if (Utils_1.default.IsEqual(tl.getInput(constants.customizerWindowsUpdate), "true")) {
            this.windowsUpdateProvisioner = true;
        }
        else {
            this.windowsUpdateProvisioner = false;
        }
        //distribute inputs
        if (!this.isTemplateJsonProvided) {
            this.distributeType = tl.getInput(constants.DistributeType);
            const distResourceId = tl.getInput(constants.DistResourceId);
            const distLocation = tl.getInput(constants.DistLocation);
            if (!(Utils_1.default.IsEqual(this.distributeType, "VHD") || Utils_1.default.IsEqual(this.distributeType, "ManagedImage"))) {
                if (distResourceId == "" || distResourceId == undefined) {
                    throw Error("Distributor Resource Id is required");
                }
                if (distLocation == undefined || distLocation == "") {
                    throw Error("Distributor Location is required");
                }
            }
            if (Utils_1.default.IsEqual(this.distributeType, constants.managedImageSourceTypeImage)) {
                if (distResourceId) {
                    this.imageIdForDistribute = distResourceId;
                }
                this.managedImageLocation = this.location;
            }
            else if (Utils_1.default.IsEqual(this.distributeType, constants.sharedImageGallerySourceTypeImage)) {
                this.galleryImageId = distResourceId;
                this.replicationRegions = distLocation;
            }
            this.distImageTags = tl.getInput(constants.DistImageTags);
        }
        this.runOutputName = tl.getInput(constants.RunOutputName);
        console.log("end reading parameters");
    }
    _extractImageDetails(img) {
        this.imagePublisher = "";
        this.imageOffer = "";
        this.imageSku = "";
        this.baseImageVersion;
        var parts = img.split(':');
        if (parts.length != 4) {
            throw Error("Platform Base Image should have '{publisher}:{offer}:{sku}:{version}'. All fields are required.");
        }
        this.imagePublisher = parts[0];
        this.imageOffer = parts[1];
        this.imageSku = parts[2];
        this.baseImageVersion = parts[3];
    }
}
exports.default = TaskParameters;
