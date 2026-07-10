# Production Security Checklist

- [ ] Change all default secrets (`JWT_*`, `PAYMENT_WEBHOOK_SECRET`)
- [ ] Set `NODE_ENV=production`
- [ ] Disable Swagger (`SWAGGER_ENABLED=false`)
- [ ] Configure HTTPS termination at load balancer
- [ ] Restrict CORS to production domains
- [ ] Enable database encryption at rest (cloud provider)
- [ ] Configure secret manager (AWS Secrets Manager / Vault)
- [ ] Set up WAF / DDoS protection
- [ ] Configure log aggregation (ELK/Datadog)
- [ ] Enable Prometheus alerting on error rate spikes
- [ ] Review RBAC role assignments
- [ ] Run `npm audit` before each deploy
