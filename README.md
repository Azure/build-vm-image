# GitHub Action to Build Custom Virtual Machine Images

With the Build Azure Virtual Machine Image action, you can now easily create custom virtual machine images that contain artifacts produced in your CI/CD workflows and have pre-installed software.  This action not only lets you build customized images but also distribute them using image managing Azure services like [Shared Image Gallery](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/shared-image-galleries). These images can then be used for creating [Virtual Machines](https://azure.microsoft.com/en-in/services/virtual-machines/) or [Virtual Machine Scale Sets](https://docs.microsoft.com/en-us/azure/virtual-machine-scale-sets/overview) 


The definition of this Github Action is in [action.yml](https://github.com/Azure/build-vm-image/blob/master/action.yml).

Note that this action uses [Azure Image Builder](https://azure.microsoft.com/en-in/blog/streamlining-your-image-building-process-with-azure-image-builder/) service in the background for creating and publishing images. 


## Pre-requisites:

* User Assigned Managed Identity: A managed identity is required for Azure Image Builder(AIB) to distribute images(Shared Image Gallery or Managed Image). You must create an [Azure user-assigned managed identity](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/how-to-manage-ua-identity-cli) that will be used during the image build to read and write images. You then need to grant it permission to do specific actions using a [custom role](https://docs.microsoft.com/en-us/azure/role-based-access-control/custom-roles-portal) with the following json(replace your subscription id and resource group name)  and assign it to the managed identity. 


```json
{
    "Name": "Image Creation Role",
    "IsCustom": true,
    "Description": "Azure Image Builder access to create resources for the image build",
    "Actions": [
        "Microsoft.Compute/galleries/read",
        "Microsoft.Compute/galleries/images/read",
        "Microsoft.Compute/galleries/images/versions/read",
        "Microsoft.Compute/galleries/images/versions/write",

        "Microsoft.Compute/images/write",
        "Microsoft.Compute/images/read",
        "Microsoft.Compute/images/delete"
    ],
    "NotActions": [
  
    ],
    "AssignableScopes": [
      "/subscriptions/<subscriptionID>/resourceGroups/<rgName>"
    ]
  }

```


# Inputs for the Action

* `resource-group-name`: Required. This is the resource group where the action creates a storage for saving artifacts needed for customized image.  Azure image builder also uses the same resource group for Image Template creation. 

* `image-builder-template-name`:  The name of the image builder template resource to be used for creating and running the Image builder service. If you already have an [AIB Template file](https://github.com/danielsollondon/azvmimagebuilder/tree/master/quickquickstarts) downloaded in the runner, then you can give the full filepath to that as well. E.g. _${{ GITHUB.WORKSPACE }}/vmImageTemplate/ubuntuCustomVM.json_. Note that incase a filepath is provided in this action input, then parameters in the file will take precedence over action inputs. Irrespective, customizer section of action is always executed. 

* `location`: This is the location where the Azure Image Builder(AIB) will run. Eg, 'eastus2'. AIB supports only a [specific set of locations](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/image-builder-overview#regions). The source images must be present in this location, so for example, if you are using Shared Image Gallery, a replica must exist in that region. This is optional if AIB template filepath is provided in `image-builder-template` input.

* `build-timeout-in-minutes`: Optional. Time after which the build is cancelled. Defaults to 240.

* `vm-size`: Optional. By default AIB uses a "Standard_D1_v2" build VM, however, you can override this. Check out different VM sizes offered in azure [here](https://docs.microsoft.com/en-us/azure/virtual-machines/sizes).


*  `managed-identity`: As mentioned in pre-requisites, AIB will use the user assigned managed identity to add the image into the resource group. It takes the full identifier for managed identity or if you have the managed identity in the same resource group then just the name of managed identity suffices. Refer the sample input value below. You can find more details about identity creation [here](https://docs.microsoft.com/en-us/azure/virtual-machines/windows/image-builder#create-a-user-assigned-identity-and-set-permissions-on-the-resource-group). This is input is optional if AIB template filepath is provided in `image-builder-template` input.  

    ```yaml
    /subscriptions/xxxxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxx/resourceGroups/my-dev-rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/my-imagebuild-identity
    ```


*  `source-os-type`: Required. The OS type of the base image(i.e. source image). It can be set to [ Linux | Windows ].
* `source-image-type`: The  base image type that will be used for creating the custom image. This should be set to one of three types: [ PlatformImage | SharedImageGallery | ManagedImage ]. This is input is optional if AIB template filepath is provided in `image-builder-template` input
* `source-image`: This is the resource identifier for base image.  A source image should be present in the same Azure region set in the input value of `location`. This is input is optional if AIB template filepath is provided in `image-builder-template` input

  * If the `source-image-type` is PlatformImage, then the value of `source-image` will be the urn of image. Format 'publisher:offer:sku:version' E.g. _Ubuntu:Canonical:18.04-LTS:latest_. You can run the following AZ CLI command to list images available 
  
    ```bash
    az vm image list   or az vm image show 
    ```
  * if the `source-image-type` is ManagedImage - the value of source-image is the resourceId of the source image, for example:
  
    ```yaml
    /subscriptions/<subscriptionID>/resourceGroups/<rgName>/providers/Microsoft.Compute/images/<imageName>
    ```
    
  * If the `source-image-type` is SharedImageGallery - You need to pass in the resourceId of the image version for example:
  
    ```yaml
    /subscriptions/<subscriptionID>/resourceGroups/<sigResourceGroup>/providers/Microsoft.Compute/galleries/<sigName>/images/<imageDefName>/versions/<versionNumber> 
    ```
    
* `customizer-source`: Optional. This takes the path to a directory in the runner. This is the directory where you can keep all the artifacts that need to be added to the base image for customization. By default, the value is _${{ GITHUB.WORKSPACE }}/workflow_artifacts_. 
* `customizer-script `: Optional. This takes multi inline powershell or shell commands and use variables to point to directories inside the downloaded location.
* `customizer-destination` : Optional. This is the directory in the customized image where artifacts are copied to. The default path of customizer-destination would depend on the OS defined in 'source-os-type' field. For windows it is C:\ and for linux it is /tmp/. Note that for many Linux OS's, on a reboot, the /tmp directory contents are deleted. So if you need these artifacts to persist you need to write customizer script to copy them to a persistent location. Here is a sample input for customizer-script:

  ```yaml
    customizer-script: |          
      sudo mkdir /buildArtifacts
      sudo cp -r /tmp/ /buildArtifacts/
  ```

* `customizer-windows-update`: Optional. Applicable for only windows images. The value is a boolean. If set to true, the image builder will run Windows update at the end of the customizations and also handle the reboots if required. By default the value is set to 'false'

* `distributor-type`: Optional. This takes your choice for distributing the built image. It can be set to [ ManagedImage | SharedImageGallery | VHD ]. By default its ManagedImage.
* `dist-resource-id`: Optional. Takes the full resource identifier. 
  * If the distributor-type is SharedImageGallery the value can be:
    ```yaml
    /subscriptions/<subscriptionID>/resourceGroups/<rgName>/providers/Microsoft.Compute/galleries/<galleryName>/images/<imageDefName>
    ```
  * If the distributor-type is ManagedImage, the value should be of format:
    ```yaml
    /subscriptions/<subscriptionID>/resourceGroups/<rgName>/providers/Microsoft.Compute/images/<imageName>
    ```
  * If the image-type is VHD, You do not need to pass this parameter
* `dist-location`: Optional. This is required only when SharedImageGallery is the `distributor-type` 
* `dist-image-tags`: Optional. These are user defined tags that are added to the custom image created. They take key value pairs as input. E.g. _'version:beta'_
 

# End-to-End Sample Workflows

### Sample workflow to create a custom Windows OS image and distribute it as a Managed Image

```yaml
name: create_custom_windows_image

on: push

jobs:
  BUILD-CUSTOM-IMAGE:
    runs-on: ubuntu-latest    
    steps:
    - name: CHECKOUT
      uses: actions/checkout@v2
  

    - name: AZURE LOGIN 
      uses: azure/login@v1
      with:
        creds: ${{secrets.AZURE_CREDENTIALS}}

    - name: BUILD WEBAPP
      run: sudo ${{ GITHUB.WORKSPACE }}/webApp/buildscript.sh # Runs necessary build scripts and copies built artifacts to  ${{ GITHUB.WORKSPACE }}/workflow_artifacts
      

    - name: BUILD-CUSTOM-VM-IMAGE      
      uses: azure/build-vm-image@v0
      with:        
        resource-group-name: 'myResourceGroup'
        managed-identity: 'myImageBuilderIdentity'
        location: 'eastus2'
        source-os-type: 'windows'        
        source-image: MicrosoftWindowsServer:WindowsServer:2019-Datacenter:latest        
        customizer-script: |
          & 'c:\workflow-artifacts\webApp\webconfig.ps1'

```
The above workflow will use a Microsoft Windows Server platform image as base image, inject files present in directory `${{ GITHUB.WORKSPACE }}/worflow-artifacts` of GitHub runner into the base image at default `customizer-destination` directory and  run image customizations(E.g. Set up IIS web server, configure bindings etc) using script webconfig.ps1, finally it will distribute the baked custom image as a Managed Image(default distribution)


### Sample workflow to create a custom Ubuntu OS image and distribute it as Managed Image 

```yaml
on: push

jobs:      
  job1:
    runs-on: ubuntu-latest
    name: Create Custom Linux Image
    steps:
    - name: Checkout
      uses: actions/checkout@v2
    
    - name: Create Workflow Artifacts
      run: |
        cd  "$GITHUB_WORKFLOW"
        mkdir worflow-artifacts/        
        echo "echo Installing World... " > $GITHUB_WORKSPACE/workflow-artifacts/install-world.sh  # You can have your own installation script here

    
    - name: Login via Az module
      uses: azure/login@v1
      with:
        creds: ${{secrets.AZURE_CREDENTIALS}}
    
    - name: Build and Distribute Custom VM Image      
      uses: azure/build-vm-image@v0
      with:        
        resource-group-name: 'myResourceGroup'
        location: 'eastus2'
        managed-identity: 'myImageBuilderIdentity'
        source-os-type: 'linux'
        source-image-type: 'PlatformImage'
        source-image: Canonical:UbuntuServer:18.04-LTS:latest 
        customizer-source: ${{ GITHUB.WORKSPACE }}/workflow_artifacts
        customizer-script: |
          sudo mkdir /buildArtifacts
          sudo cp -r /tmp/ /buildArtifacts/
          sh /buildArtifacts/workflow-artifacts/install-world.sh

        
```
The above workflow will use a linux platform image as base image, inject files present in directory `${{ GITHUB.WORKSPACE }}/worflow-artifacts` of GitHub runner into the base image at default `customizer-destination` directory and run install-world.sh script. Finally it will distribute the baked custom image as a Managed Image(default distribution)


### Sample workflow to create a custom Ubuntu OS image and distribute through Shared Image Gallery

```yaml
on: push

jobs:
  BUILD-CUSTOM-UBUNTU-IMAGE:
    runs-on: ubuntu-latest    
    steps:
    - name: CHECKOUT
      uses: actions/checkout@v2
  

    - name: AZURE LOGIN 
      uses: azure/login@v1
      with:
        creds: ${{secrets.AZURE_CREDENTIALS}}

    - name: BUILD WEBAPP
      run: sudo ${{ GITHUB.WORKSPACE }}/webApp/buildscript.sh # Run necessary build scripts and copies built artifacts to  ${{ GITHUB.WORKSPACE }}/workflow_artifacts
      

    - name: BUILD-CUSTOM-VM-IMAGE      
      uses: azure/build-vm-image@v0
      with:        
        resource-group-name: 'myResourceGroup'
        managed-identity: 'myImageBuilderIdentity'
        location: 'eastus2'
        source-os-type: 'linux'        
        source-image: Canonical:UbuntuServer:18.04-LTS:latest      
        customizer-script: |
          sh /tmp/workflow-artifacts/install.sh
        distributor-type: 'SharedImageGallery'
        dist-resource-id: '/subscriptions/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/resourceGroups/myResourceGroup/providers/Microsoft.Compute/galleries/AppTeam/images/ImagesWithApp'
        dist-location: 'eastus2'
          
        
```
The above workflow will use a linux platform image as base image, inject files present in directory `${{ GITHUB.WORKSPACE }}/worflow-artifacts` of GitHub runner into the base image at default `customizer-destination` directory and run install.sh script. Finally it will distribute the baked custom image through Shared Image Gallery


## Configure credentials for Azure login action:

With the Azure login Action, you can perform an Azure login using [Azure service principal](https://docs.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals). The credentials of Azure Service Principal can be added as [secrets](https://help.github.com/en/articles/virtual-environments-for-github-actions#creating-and-using-secrets-encrypted-variables) in the GitHub repository and then used in the workflow. Follow the below steps to generate credentials and store in github.


  * Prerequisite: You should have installed Azure cli on your local machine to run the command or use the cloudshell in the Azure portal. To install Azure cli, follow [Install Azure Cli](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest). To use cloudshell, follow [CloudShell Quickstart](https://docs.microsoft.com/en-us/azure/cloud-shell/quickstart). After you have one of the above ready, follow these steps: 
  
  
  * Run the below Azure cli command and copy the output JSON object to your clipboard.


```bash  
  
   az ad sp create-for-rbac --name "myApp" --role contributor \
                            --scopes /subscriptions/{subscription-id} \
                            --sdk-auth
                            
  # Replace {subscription-id} with the subscription identifiers
  
  # The command should output a JSON object similar to this:

  {
    "clientId": "<GUID>",
    "clientSecret": "<GUID>",
    "subscriptionId": "<GUID>",
    "tenantId": "<GUID>",
    (...)
  }
  
```
  * Define a 'New secret' under your GitHub repository settings -> 'Secrets' menu. Lets name it 'AZURE_CREDENTIALS'.
  * Paste the contents of the clipboard as the value of  the above secret variable.
  * Use the secret variable in the Azure Login Action(Refer to the examples above)


If needed, you can modify the Azure CLI command to further reduce the scope for which permissions are provided. Here is the command that gives contributor access to only a resource group.

```bash  
  
   az ad sp create-for-rbac --name "myApp" --role contributor \
                            --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
                            --sdk-auth
                            
  # Replace {subscription-id}, {resource-group} with the subscription and resource group identifiers.
  
```

You can also provide permissions to multiple scopes using the Azure CLI command: 

```bash  
  
   az ad sp create-for-rbac --name "myApp" --role contributor \
                            --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group1} \
                            /subscriptions/{subscription-id}/resourceGroups/{resource-group2} \
                            --sdk-auth
                            
  # Replace {subscription-id}, {resource-group1}, {resource-group2} with the subscription and resource group identifiers.
  
```
# Feedback

If you have any changes you’d like to see or suggestions for this action,  we’d love your feedback ❤️ . Please feel free to raise a GitHub issue in this repository describing your suggestion. This would enable us to label and track it properly. You can do the same if you encounter a problem with the feature as well.

# Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
