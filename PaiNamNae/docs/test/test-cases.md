# Test Cases

## Sprint 1 

### Item No.4 Automated Verification

### TC01 – Register user with valid data
Endpoint: POST /api/users
Expected Result:
- Status 201
- success = true
- verification triggered

---

### TC02 – Auto verification success case
Expected Result:
- isVerified = true
- notification created
- confidence > threshold

---

### TC03 – Auto verification fail case
Expected Result:
- isVerified = false

---

### Item No.12 Driver Pickup Notification

### TC01: Driver near aleart test
Expected Result:
- passenger get notification when driver far from pickup location less than 5 km

---

### TC02: Driver near not aleart test (distance far more than 5 km)
Expected Result:
- passenger don't receive notification when driver far from pickup location more than 5 km