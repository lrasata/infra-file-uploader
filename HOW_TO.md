# How to build `sharp`

`sharp` is used in the Lambda function which process files after they are uploaded in S3 bucket. It is use to generate thumbnail of uplaoded files.

See in folder: `terraform/modules/file_uploader/submodules/lambda_functions/src/lambdas/process_uploaded_file/`

## On Linux or MacOS

Please refer to [the official documentation](https://www.npmjs.com/package/sharp)

Execute commands locally in the folder : `cd terraform/modules/file_uploader/submodules/lambda_functions/src/lambdas/process_uploaded_file`

## On Windows

Execute  the following commands locally in the folder : `cd terraform\modules\file_uploader\submodules\lambda_functions\src\lambdas\process_uploaded_file`

### Run an Amazon Linux container

`docker run -it --rm -v ${PWD}:/var/task amazonlinux:2023 bash`

### Inside container

```txt
dnf install -y nodejs npm make gcc-c++ libpng-devel

cd /var/task
npm install sharp

exit
```

At this point you should have `node_modules` folder generated inside `process_uploaded_file` which has been generated on the docker container.
