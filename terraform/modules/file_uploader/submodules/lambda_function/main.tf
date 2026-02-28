# IAM ROLE
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.environment}-${var.app_id}-lambda-${var.lambda_name}-exec-role"
  tags = {
    Environment = var.environment
    App         = var.app_id
  }

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# IAM POLICY
resource "aws_iam_policy" "lambda_custom_policy" {
  name        = "${var.environment}-${var.app_id}-lambda-${var.lambda_name}-policy"
  description = "Custom policy for ${var.lambda_name} lambda"

  # Use the dynamic list of statements passed from the configuration map
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = var.iam_policy_statements
  })

  tags = {
    Environment = var.environment
    App         = var.app_id
  }
}

# LAMBDA FUNCTION
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${path.module}/lambda_${var.lambda_name}.zip"
  excludes    = var.excludes
}

resource "aws_lambda_function" "lambda_function" {
  function_name = "${var.environment}-${var.app_id}-${var.lambda_name}-lambda"
  runtime       = "nodejs22.x"
  handler       = var.handler_file

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  role        = aws_iam_role.lambda_exec_role.arn
  timeout     = var.timeout
  memory_size = var.memory_size

  tags = {
    Name        = "${var.environment}-${var.lambda_name}-lambda"
    Environment = var.environment
    App         = var.app_id
  }

  environment {
    variables = var.environment_vars
  }

  depends_on = [aws_iam_role.lambda_exec_role]
}

# IAM ATTACHMENTS
resource "aws_iam_role_policy_attachment" "lambda_custom_policy_attach" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = aws_iam_policy.lambda_custom_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_logging" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}