# Production Security Checklist

- [ ] Change all default secrets (`JWT_*`, `PAYMENT_WEBHOOK_SECRET`, `MFA_ENCRYPTION_KEY`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `MFA_ENABLED=true` and enroll admin accounts
- [ ] Disable Swagger (`SWAGGER_ENABLED=false`)
- [ ] Configure HTTPS termination at load balancer
- [ ] Restrict CORS to production domains
- [ ] Enable database encryption at rest (cloud provider / Terraform RDS)
- [ ] Configure secret manager (AWS Secrets Manager via Terraform module)
- [ ] Set up WAF / DDoS protection
- [ ] Configure log aggregation (ELK/Datadog)
- [ ] Enable Prometheus alerting on error rate spikes
- [ ] Review RBAC role assignments
- [ ] Run `npm audit` before each deploy
