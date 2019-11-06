# Log Ingester Lambda Function

This code is stored in a .zip file hosted at S3 in the `concord-devops/log-ingester` bucket and used by the [log-ingester.yml CloudFormation template](https://github.com/concord-consortium/cloud-formation/)

## Updating the live code

```
cd log-ingester-lambda
./makezip.sh <version>
```

this will create `kinesis-to-rds-<version>.zip`.  Then upload the .zip file to the `concord-devops/log-ingester` bucket
and update the `LambdaZipFilename` parameter in the log-ingester stack in the AWS console and redeploy.

## Testing the Lambda function

Once the code is deployed you can use the following payload to test the function in the AWS console:

```
{
    "Records": [
        {
            "kinesis": {
                "kinesisSchemaVersion": "1.0",
                "partitionKey": "todo",
                "sequenceNumber": "49592726167714857316135803118515680514645498297090834434",
                "data": "O3sic2Vzc2lvbiI6InRlc3QiLCJ1c2VybmFtZSI6ImRtYXJ0aW4ifQ==",
                "approximateArrivalTimestamp": 1549473921.272
            },
            "eventSource": "aws:kinesis",
            "eventVersion": "1.0",
            "eventID": "shardId-000000000000:49592726167714857316135803118515680514645498297090834434",
            "eventName": "aws:kinesis:record",
            "invokeIdentityArn": "arn:aws:iam::612297603577:role/log-ingester-staging-kinesis-lambda",
            "awsRegion": "us-east-1",
            "eventSourceARN": "arn:aws:kinesis:us-east-1:612297603577:stream/log-ingester-staging-api-gateway-stream"
        }
    ]
  }
```