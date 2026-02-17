const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

const SEED_PASSWORD = process.env.SEED_TEST_PASSWORD || "Admin1234!";

const driverSeed = {
  email: process.env.SEED_DRIVER_EMAIL || "driver@example.com",
  username: process.env.SEED_DRIVER_USERNAME || "driver",
  firstName: process.env.SEED_DRIVER_FIRST_NAME || "Test",
  lastName: process.env.SEED_DRIVER_LAST_NAME || "Driver",
  phoneNumber: process.env.SEED_DRIVER_PHONE || "0800000001",
  gender: process.env.SEED_DRIVER_GENDER || "male",
  role: "DRIVER",
  isVerified: true,
};

const passengerSeed = {
  email: process.env.SEED_PASSENGER_EMAIL || "passenger@example.com",
  username: process.env.SEED_PASSENGER_USERNAME || "passenger",
  firstName: process.env.SEED_PASSENGER_FIRST_NAME || "Test",
  lastName: process.env.SEED_PASSENGER_LAST_NAME || "Passenger",
  phoneNumber: process.env.SEED_PASSENGER_PHONE || "0800000002",
  gender: process.env.SEED_PASSENGER_GENDER || "female",
  role: "PASSENGER",
  isVerified: true,
};

const verificationSeed = {
  preferredLicenseNumber:
    process.env.SEED_DRIVER_LICENSE_NUMBER || "DVR-SEED-0001",
  firstNameOnLicense:
    process.env.SEED_DRIVER_LICENSE_FIRST_NAME || driverSeed.firstName,
  lastNameOnLicense:
    process.env.SEED_DRIVER_LICENSE_LAST_NAME || driverSeed.lastName,
  licenseIssueDate:
    process.env.SEED_DRIVER_LICENSE_ISSUE_DATE || "2020-01-01T00:00:00.000Z",
  licenseExpiryDate:
    process.env.SEED_DRIVER_LICENSE_EXPIRY_DATE || "2030-01-01T00:00:00.000Z",
  licensePhotoUrl:
    process.env.SEED_DRIVER_LICENSE_PHOTO_URL ||
    "https://drive.google.com/file/d/1ppQ3aWJXvaZ-hv6XafsTxG1qIVNxBXNP/view?usp=sharing",
  selfiePhotoUrl:
    process.env.SEED_DRIVER_SELFIE_PHOTO_URL ||
    "https://drive.google.com/file/d/1h-26H-YPd5-eyGaaV9_eosh72OpwZspE/view?usp=sharing",
  typeOnLicense: process.env.SEED_DRIVER_LICENSE_TYPE || "PRIVATE_CAR",
  status: "APPROVED",
};

const vehicleSeed = {
  preferredLicensePlate:
    process.env.SEED_DRIVER_VEHICLE_PLATE || "SEED-DRV-001",
  vehicleModel: process.env.SEED_DRIVER_VEHICLE_MODEL || "Toyota Altis",
  vehicleType: process.env.SEED_DRIVER_VEHICLE_TYPE || "Sedan",
  color: process.env.SEED_DRIVER_VEHICLE_COLOR || "White",
  seatCapacity: Number(process.env.SEED_DRIVER_VEHICLE_SEAT || 4),
  amenities: (process.env.SEED_DRIVER_VEHICLE_AMENITIES ||
    "Air Conditioner,USB Charger")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  photos: [
    process.env.SEED_DRIVER_VEHICLE_PHOTO_URL ||
      "https://drive.google.com/file/d/1h-26H-YPd5-eyGaaV9_eosh72OpwZspE/view?usp=sharing",
  ],
  isDefault: true,
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

async function resolveUsername(preferred, currentUserId) {
  const base = normalizeUsername(preferred).replace(/\s+/g, "_") || "user_seed";

  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base}_${i + 1}`;
    const owner = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!owner || owner.id === currentUserId) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate username for base "${base}"`);
}

async function resolveLicenseNumber(preferred, currentUserId) {
  const base = String(preferred || "").trim() || "DVR-SEED";

  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const owner = await prisma.driverVerification.findUnique({
      where: { licenseNumber: candidate },
      select: { userId: true },
    });

    if (!owner || owner.userId === currentUserId) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate license number for base "${base}"`);
}

async function resolveVehiclePlate(preferred, currentUserId) {
  const base = String(preferred || "").trim() || "SEED-DRV";

  for (let i = 0; i < 1000; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const owner = await prisma.vehicle.findUnique({
      where: { licensePlate: candidate },
      select: { userId: true },
    });

    if (!owner || owner.userId === currentUserId) {
      return candidate;
    }
  }

  throw new Error(`Unable to allocate license plate for base "${base}"`);
}

async function ensureUser(seed) {
  const email = normalizeEmail(seed.email);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  const username = await resolveUsername(seed.username, existing?.id);
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        username,
        password: passwordHash,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phoneNumber: seed.phoneNumber,
        gender: seed.gender,
        role: seed.role,
        isVerified: seed.isVerified,
        isActive: true,
      },
    });
  }

  return prisma.user.create({
    data: {
      email,
      username,
      password: passwordHash,
      firstName: seed.firstName,
      lastName: seed.lastName,
      phoneNumber: seed.phoneNumber,
      gender: seed.gender,
      role: seed.role,
      isVerified: seed.isVerified,
      isActive: true,
    },
  });
}

async function ensureDriverVerification(driverUserId) {
  const existing = await prisma.driverVerification.findUnique({
    where: { userId: driverUserId },
    select: { id: true, licenseNumber: true },
  });

  const licenseNumber = existing?.licenseNumber
    ? existing.licenseNumber
    : await resolveLicenseNumber(
        verificationSeed.preferredLicenseNumber,
        driverUserId
      );

  const payload = {
    userId: driverUserId,
    licenseNumber,
    firstNameOnLicense: verificationSeed.firstNameOnLicense,
    lastNameOnLicense: verificationSeed.lastNameOnLicense,
    licenseIssueDate: new Date(verificationSeed.licenseIssueDate),
    licenseExpiryDate: new Date(verificationSeed.licenseExpiryDate),
    licensePhotoUrl: verificationSeed.licensePhotoUrl,
    selfiePhotoUrl: verificationSeed.selfiePhotoUrl,
    typeOnLicense: verificationSeed.typeOnLicense,
    status: verificationSeed.status,
  };

  if (existing) {
    return prisma.driverVerification.update({
      where: { id: existing.id },
      data: payload,
    });
  }

  return prisma.driverVerification.create({ data: payload });
}

async function ensureDriverVehicle(driverUserId) {
  const existingForDriver = await prisma.vehicle.findFirst({
    where: { userId: driverUserId },
    select: { id: true, licensePlate: true },
    orderBy: { createdAt: "asc" },
  });

  const licensePlate = existingForDriver?.licensePlate
    ? existingForDriver.licensePlate
    : await resolveVehiclePlate(vehicleSeed.preferredLicensePlate, driverUserId);

  await prisma.vehicle.updateMany({
    where: { userId: driverUserId, isDefault: true },
    data: { isDefault: false },
  });

  const payload = {
    userId: driverUserId,
    licensePlate,
    vehicleModel: vehicleSeed.vehicleModel,
    vehicleType: vehicleSeed.vehicleType,
    color: vehicleSeed.color,
    seatCapacity: vehicleSeed.seatCapacity,
    amenities: vehicleSeed.amenities,
    photos: vehicleSeed.photos,
    isDefault: vehicleSeed.isDefault,
  };

  if (existingForDriver) {
    return prisma.vehicle.update({
      where: { id: existingForDriver.id },
      data: payload,
    });
  }

  return prisma.vehicle.create({ data: payload });
}

async function main() {
  const driver = await ensureUser(driverSeed);
  const passenger = await ensureUser(passengerSeed);

  await prisma.user.update({
    where: { id: driver.id },
    data: { role: "DRIVER", isVerified: true, isActive: true },
  });
  await prisma.user.update({
    where: { id: passenger.id },
    data: { role: "PASSENGER", isVerified: true, isActive: true },
  });

  const verification = await ensureDriverVerification(driver.id);
  const vehicle = await ensureDriverVehicle(driver.id);

  const output = {
    password: SEED_PASSWORD,
    driver: {
      id: driver.id,
      email: driver.email,
      username: driver.username,
      isVerified: true,
      role: "DRIVER",
      verificationStatus: verification.status,
      verificationId: verification.id,
      vehicleId: vehicle.id,
      vehiclePlate: vehicle.licensePlate,
    },
    passenger: {
      id: passenger.id,
      email: passenger.email,
      username: passenger.username,
      isVerified: true,
      role: "PASSENGER",
    },
  };

  console.log("Seed completed for Sprint 1 test data.");
  console.log(JSON.stringify(output, null, 2));
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
