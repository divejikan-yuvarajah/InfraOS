import bcrypt from "bcryptjs";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { User } from "../modules/identity/models/user.model.js";

async function main(): Promise<void> {
  const email = process.argv[2] || "superadmin@infraos.test";
  const newPassword = process.argv[3] || "Admin@12345678";

  console.log(`Connecting to database to update credentials for ${email}...`);
  await connectDatabase(env);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User with email "${email}" not found.`);
    await disconnectDatabase();
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 12);
  user.passwordHash = hash;
  user.status = "ACTIVE";
  user.emailVerified = true;
  user.credentialEpoch = (user.credentialEpoch ?? 0) + 1;
  await user.save();

  console.log(`Password updated successfully!`);
  console.log(`Email:    ${email}`);
  console.log(`Password: ${newPassword}`);
  await disconnectDatabase();
}

main().catch(async (error: unknown) => {
  console.error("Failed to update password:", error);
  try {
    await disconnectDatabase();
  } catch {
    // ignore
  }
  process.exit(1);
});

