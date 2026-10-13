# Sample Data

Sample fixtures must be clearly fictional and safe for local development.

```json
{
  "program": {
    "code": "SPM-DEMO",
    "name": "State Projects Monitoring Demonstration",
    "country": "NG"
  },
  "project": {
    "publicId": "demo-community-health-centre",
    "title": "Construction of Community Health Centre",
    "description": "Demonstration record for interface development.",
    "fiscalYear": "2026",
    "location": ["Niger", "Bosso"],
    "agency": "Example Public Agency",
    "trackingStatus": "ACTION_REQUIRED"
  },
  "allocation": {
    "amount": "80000000.00",
    "currency": "NGN",
    "source": "Demonstration Budget",
    "visibility": "REGISTERED_VIEWER"
  }
}
```

Fixtures should cover every state and permission outcome, including draft versus public versions, changes requested, multi-currency separation, missing evidence, restricted evidence, and access denial.
