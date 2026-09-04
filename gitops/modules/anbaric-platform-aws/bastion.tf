# An optional, keyless SSM bastion: a jump host for reaching the private RDS
# from a laptop. There is no inbound SSH and no key pair — you connect with
# Session Manager port forwarding over the bastion's outbound channel:
#
#   aws ssm start-session --target <bastion_instance_id> \
#     --document-name AWS-StartPortForwardingSessionToRemoteHost \
#     --parameters host=<database_endpoint>,portNumber=5432,localPortNumber=5432
#
# then point psql at localhost:5432. Turn it on per-environment with
# enable_bastion; leave it off (and it costs nothing) the rest of the time.

data "aws_ami" "bastion" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_security_group" "bastion" {
  count       = var.enable_bastion ? 1 : 0
  name        = "anbaric-${var.environment}-bastion"
  description = "SSM bastion for reaching the private database"
  vpc_id      = aws_vpc.anbaric.id

  # No ingress: Session Manager is initiated outbound by the SSM agent.
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "anbaric-${var.environment}-bastion" }
}

resource "aws_iam_role" "bastion" {
  count = var.enable_bastion ? 1 : 0
  name  = "anbaric-${var.environment}-bastion"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "bastion_ssm" {
  count      = var.enable_bastion ? 1 : 0
  role       = aws_iam_role.bastion[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "bastion" {
  count = var.enable_bastion ? 1 : 0
  name  = "anbaric-${var.environment}-bastion"
  role  = aws_iam_role.bastion[0].name
}

resource "aws_instance" "bastion" {
  count                       = var.enable_bastion ? 1 : 0
  ami                         = data.aws_ami.bastion.id
  instance_type               = "t4g.nano"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.bastion[0].id]
  iam_instance_profile        = aws_iam_instance_profile.bastion[0].name
  associate_public_ip_address = true

  tags = { Name = "anbaric-${var.environment}-bastion" }
}
