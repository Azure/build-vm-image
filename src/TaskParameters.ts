"use strict";
import path = require("path");
import * as tl from '@actions/core';
import * as constants from "./constants";
import Utils from "./Utils";
var fs = require('fs');

export default class TaskParameters {
    // image builder inputs
    public resourceGroupName: string = "";
    public location: string = "";
    public imagebuilderTemplateName: string;
    public isTemplateJsonProvided: boolean = false;
    public templateJsonFromUser: string = '';
    public buildTimeoutInMinutes: number = 240;
    public vmSize: string = "";
    public managedIdentity: string = "";

    // source
    public sourceImageType: string = "";
    public sourceOSType: string = "";
    public sourceResourceId: string = "";
    public imageVersionId: string = "";
    public baseImageVersion: string = "";
    public imagePublisher: string = "";
    public imageOffer: string = "";
    public imageSku: string = "";

    //customize
    public buildPath: string = "";
    public buildFolder: string = "";
    public blobName: string = "";
    public inlineScript: string;
    public provisioner: string = "";
    public windowsUpdateProvisioner: boolean;
    public customizerSource: string = "";
    public customizerScript: string = "";
    public customizerWindowsUpdate: string = "";

    //distribute
    public distributeType: string = "";
    public imageIdForDistribute: string = "";
    public replicationRegions: string = "";
    public managedImageLocation: string = "";
    public galleryImageId: string = "";
    public runOutputName: string;
    public distImageTags: string = "";

    constructor() {
        var locations = ["eastus", "eastus2", "westcentralus", "westus", "westus2", "southcentralus", "northeurope", "westeurope", "southeastasia", "australiasoutheast", "australia", "uksouth", "ukwest" ];

        console.log("start reading task parameters...");

        this.imagebuilderTemplateName = tl.getInput(constants.ImageBuilderTemplateName);
        if (this.imagebuilderTemplateName.indexOf(".json") > -1) {
            this.isTemplateJsonProvided = true;
            var data = fs.readFileSync(this.imagebuilderTemplateName, 'utf8');
            this.templateJsonFromUser = JSON.parse(JSON.stringify(data));
        }

        this.resourceGroupName = tl.getInput(constants.ResourceGroupName, { required: true });
        this.buildTimeoutInMinutes = parseInt(tl.getInput(constants.BuildTimeoutInMinutes));
        this.sourceOSType = tl.getInput(constants.SourceOSType, { required: true });
        if (Utils.IsEqual(this.sourceOSType, "windows")) {
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
            if (Utils.IsEqual(this.sourceImageType, constants.platformImageSourceTypeImage) || Utils.IsEqual(this.sourceImageType, constants.marketPlaceSourceTypeImage)) {
                this.sourceImageType = constants.platformImageSourceTypeImage;
                this._extractImageDetails(sourceImage);
            }
            else if (Utils.IsEqual(this.sourceImageType, constants.managedImageSourceTypeImage)) {
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
        if (Utils.IsEqual(tl.getInput(constants.customizerWindowsUpdate), "true")) {
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

            if (!(Utils.IsEqual(this.distributeType, "VHD") || Utils.IsEqual(this.distributeType, "ManagedImage"))) {
                if (distResourceId == "" || distResourceId == undefined) {
                    throw Error("Distributor Resource Id is required");
                }
                if (distLocation == undefined || distLocation == "") {
                    throw Error("Distributor Location is required");
                }
            }
            if (Utils.IsEqual(this.distributeType, constants.managedImageSourceTypeImage)) {
                if (distResourceId) {
                    this.imageIdForDistribute = distResourceId;
                }
                this.managedImageLocation = this.location;
            }
            else if (Utils.IsEqual(this.distributeType, constants.sharedImageGallerySourceTypeImage)) {
                this.galleryImageId = distResourceId;
                this.replicationRegions = distLocation;
            }
            this.distImageTags = tl.getInput(constants.DistImageTags);
        }

        this.runOutputName = tl.getInput(constants.RunOutputName);

        console.log("end reading parameters")
    }

    private _extractImageDetails(img: string) {
        this.imagePublisher = "";
        this.imageOffer = "";
        this.imageSku = "";
        this.baseImageVersion
        var parts = img.split(':');
        if (parts.length != 4) {
            throw Error("Platform Base Image should have '{publisher}:{offer}:{sku}:{version}'. All fields are required.")
        }
        this.imagePublisher = parts[0];
        this.imageOffer = parts[1];
        this.imageSku = parts[2];
        this.baseImageVersion = parts[3];
    }
}
