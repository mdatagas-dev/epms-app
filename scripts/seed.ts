import { auth } from "../lib/auth-config.ts";
import { db } from "../lib/pool.ts";

const users = [
  {
    email: requiredEnv("EPMS_ENGINEER_EMAIL"),
    username: requiredEnv("EPMS_ENGINEER_EMAIL").split("@", 1)[0],
    password: requiredEnv("EPMS_ENGINEER_PASSWORD"),
    name: "Raka Engineer",
    role: "engineer",
  },
  {
    email: requiredEnv("EPMS_SUPERVISOR_EMAIL"),
    username: requiredEnv("EPMS_SUPERVISOR_EMAIL").split("@", 1)[0],
    password: requiredEnv("EPMS_SUPERVISOR_PASSWORD"),
    name: "Maya Supervisor",
    role: "supervisor",
  },
] as const;

for (const user of users) {
  const existing = await db.query('SELECT id FROM "user" WHERE email = $1', [user.email]);
  if (existing.rowCount === 0) {
    await auth.api.signUpEmail({
      body: { email: user.email, username: user.username, password: user.password, name: user.name },
    });
  }
  await db.query('UPDATE "user" SET role = $1 WHERE email = $2', [user.role, user.email]);
}

await db.query(`
  INSERT INTO product_models (code, name) VALUES ('AC-SKD-12K', 'Split AC 12K BTU')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO production_lines (code, name) VALUES ('LINE-01', 'Final Assembly Line 01')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO shift_templates (name, duration_seconds, break_seconds, meeting_seconds, setup_seconds)
  VALUES ('Shift 1', 28800, 3600, 600, 900)
  ON CONFLICT (name) DO NOTHING;
  INSERT INTO process_elements (code, name, time_type) VALUES
    ('PE-010', 'Install evaporator assembly', 'manual'),
    ('PE-020', 'Vacuum process', 'machine_automatic'),
    ('PE-030', 'Electrical inspection', 'manual')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO stations (line_id, code, name, sequence)
  SELECT id, 'ST-01', 'Assembly', 1 FROM production_lines WHERE code = 'LINE-01'
  ON CONFLICT (line_id, code) DO NOTHING;
  INSERT INTO stations (line_id, code, name, sequence)
  SELECT id, 'ST-02', 'Vacuum', 2 FROM production_lines WHERE code = 'LINE-01'
  ON CONFLICT (line_id, code) DO NOTHING;
  INSERT INTO stations (line_id, code, name, sequence)
  SELECT id, 'ST-03', 'Inspection', 3 FROM production_lines WHERE code = 'LINE-01'
  ON CONFLICT (line_id, code) DO NOTHING;
`);

await db.end();
console.log(`Seed complete: ${users.map((user) => user.email).join(" and ")}`);

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
