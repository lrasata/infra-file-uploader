# Instructions for Setting Up Infrastructure 

## Run CI/CD pipeline with GitHub Actions

This repository includes GitHub Actions workflows to run Terraform plan on pull requests and automatically apply 
Terraform in controlled scenarios:

- `plan-pr-to-staging.yml` - runs on pull request events. It pulls the repository, sets up Node.js, Terraform and AWS credentials, build Lambda packages. Then it performs `terraform init`, `terraform validate`, `TFSec Security Check`,`terraform plan` (staging), uploads the plan as an artifact, and comments the output on the PR.
- `apply-to-ephemeral-env.yml` - triggers a Terraform apply to ephemeral env when a PR review is submitted with state `approved`. It also supports `workflow_dispatch` for manual apply.
- `destroy-ephemeral-env.yml` - once the PR is merged, ephemeral env is automatically destroyed. It also supports `workflow_dispatch` for manual apply.

**Manual workflow** - since currently no environment is up 24h/7, the following env are deployed manually 
- `apply-to-staging-or-prod.yml`
- `destroy-staging.yml`


Required GitHub Secrets for these workflows:

- `AWS_REGION` — AWS region to use e.g. `eu-central-1`.
- `BACKEND_CERTIFICATE_ARN` — backend certificate arn for the domain name
- `SECRET_STORE_NAME` — Per env, define this secret store nameof Secret Manager

Workflow details:

- The plan workflow runs Terraform in `terraform/live/staging` and comments a plan snapshot on the PR.
- The PR-approval triggers apply workflow to `terraform/live/ephemeral` by default.
- The push-to-main workflow applies the `terraform/live/ephemeral` environment to be destroyed.

## Prerequisites

- Terraform >= 1.6.0, < 2.0.0 installed: https://www.terraform.io/downloads.html
- Access to **AWS configured**. This include settings up **OpenID Connect** to connect GitHub Actions to AWS.
- **Secret values** are configured saved in Secrets Manager:
  - secrets : `${var.environment}/file-upload/secrets`
    - API_GW_SECRET_TOKEN : Api Token expected by `/upload` and `/files` in `Auhtorization Bearer API_Token` for requesting data and presigned URLs.
- **Important:**
  - Decide what should be the max size of file upload. Depending on this value, you might adjust the **memory size** allocated for Lambda processing file. It can be configured from 128 MB up to 10,240 MB. Default value in this terraform project is **512 MB**
- *Only if you run this Terraform configuration **locally** and not in CI/CD pipeline*:
  - Build `sharp` and `aws-sdk` for Lambda function `process-uploaded-file-lambda`
    - Refer to [HOW_TO](HOW_TO.md) section
- Optional: **BucketAV** stack to be successfully deployed.
  - BucketAV is the antivirus used and tested in this project. You can disable it by providing `var.use_bucketav = false`
  - If you decide to use BucketAV (highly recommended), after purchasing it on AWS Marketplace then follow the [steps to deploy the bucketav stack](https://bucketav.com/help/setup-guide/amazon-s3-step-1.html)
    - once bucketav stack is successfully created, follow the steps below


### Terraform Remote State Configuration

This project uses an **S3 Backend** to store Terraform state files remotely. This ensures that the state is shared, versioned, and locked to prevent concurrent modifications.

#### 1. Bootstrapping the Backend Resources

Before you can run Terraform in any environment (e.g., `staging`), you must provision the necessary infrastructure for the backend itself (the S3 bucket and DynamoDB table). This is done using the configuration located in `terraform/bootstrap`.

**Steps to Bootstrap:**

1. Navigate to the bootstrap directory:
   ```bash
   cd terraform/bootstrap
   ```

2. Initialize and apply the bootstrap configuration after specifying the variables:
   e.g.
   ```text
   # bootstrap.tfvars
   environment           = "ephemeral"
   s3_bucket_name_prefix = "file-uploader"
   app_id                = "my-app"
   ```
   
   ```bash
   terraform init
   terraform apply -var-file="bootstrap.tfvars"
   ```

3. **Note the Outputs:**
   Upon successful completion, Terraform will output the names of the created resources. You will need these values for the next step.
   * `s3_bucket_name`
   * `dynamodb_table`

#### 2. Configuring the Backend in Environments

Once the bootstrap resources are created, you must configure the backend for your environments (e.g., `terraform/live/staging/provider.tf`).

1. Open the `provider.tf` file for the specific environment (e.g., `terraform/live/staging/provider.tf`).
2. Update the `backend "s3"` block with the values obtained from the bootstrap step:

   ```hcl
   terraform {
     backend "s3" {
       # REPLACE with the 's3_bucket_name' output from the bootstrap step
       bucket = "file-uploader-terraform-state-<YOUR_ACCOUNT_ID>"

       # The key path for the state file within the bucket (unique per environment)
       key    = "staging/terraform.tfstate"

       # AWS Region
       region = "eu-central-1"

       # REPLACE with the 'dynamodb_table' output from the bootstrap step
       dynamodb_table = "staging-file-uploader-terraform-locks"

       encrypt = true
     }
     # ...
   }
   ```
3. Initialize the environment:
   ```bash
   cd ../live/staging
   terraform init
   ```

##  File Uploader Environment variables

This project uses .tfvars files to handle multiple environments (e.g., dev, staging, prod).

**Example .tfvars files:**

````text
# staging.tfvars
region      = "eu-central-1"
environment = "staging"

api_file_upload_domain_name = "staging-api-file-upload.epic-trip-planner.com"
backend_certificate_arn      =

uploads_bucket_name          = "trip-planner-app-uploads-bucket"
enable_transfer_acceleration = true


lambda_upload_presigned_url_expiration_time_s = 300 # 5min

use_bucketav                     = true
bucketav_sns_findings_topic_name = "bucketav-FindingsTopic-id"

secret_store_name = "staging/file-upload/secrets"

route53_zone_name = "epic-trip-planner.com"
````


Plan and apply for a specific environment:

````text
terraform plan -var-file="staging.tfvars"
terraform apply -var-file="staging.tfvars"
````

## Usage 

Use the specified API Gateway endpoint to request a presigned URL to upload a file.

````text
# Endpoint that returns the presigned URL
presign_endpoint =  "https://${api_file_upload_domain_name}/upload"
````


Provide the following query parameters:

````text
params = {
  [partition_key]: "id",
  [sort_key]: "file_key",
  "ext": "png",
  "resource": "trips"
}
````
