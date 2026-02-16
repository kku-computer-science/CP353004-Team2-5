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
