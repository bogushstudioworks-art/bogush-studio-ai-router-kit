## Summary

- 

## Verification

- [ ] `npm ci`
- [ ] `npm test`
- [ ] Secret/config scan reviewed when deployment files changed

## Safety Notes

- [ ] No real Telegram tokens, webhook secrets, Google project IDs, or service accounts were committed
- [ ] No raw chat IDs or user message text were added to logs
- [ ] Cloud Run changes keep dry-run/staging behavior explicit
