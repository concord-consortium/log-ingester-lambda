# Log Ingester Lambda Function

This code is stored in a .zip file hosted at S3 in the `concord-devops/log-ingester` bucket and used by the [log-ingester.yml CloudFormation template](https://github.com/concord-consortium/cloud-formation/)

## Updating the live code

1. Make your source changes
2. Uncomment the test code at the bottom of the index.js file to test your changes
3. Create the .zip file using:

```
cd log-ingester-lambda
zip -r9 ../kinesis-to-rds-VERSION.zip
```

4. Upload the .zip file to the `concord-devops/log-ingester` bucket.
5. Update the `S3Key` in the `log-ingester.yml` here:

```
Code:
  S3Bucket: concord-devops
  S3Key: log-ingester/kinesis-to-rds-VERSION.zip
```

6. Commit your `log-ingester.yml` changes and update the stack(s) in the AWS console.
