import { platformDatabaseFromEnv, poolMatchesPlatformUri } from "@/lib/clusters";
import { getVenture } from "@/lib/ventures";
import { getDb } from "@/lib/db";

/** Cluster 0 = database named in venture MONGODB_URI (Rofyt platform). */
export async function ensurePlatformCluster(slug: string) {
  const venture = await getVenture(slug);
  if (!venture) return;
  const { uri: platformUri, database } = platformDatabaseFromEnv(venture.env);
  if (!platformUri) return;

  const pool = venture.pools.find((item) => poolMatchesPlatformUri(item.uri, platformUri));
  if (!pool) return;
  if (pool.clusters.some((c) => c.orgCode === "0" || c.id === "0")) return;

  const central = await getDb();
  await central.collection("ventures").updateOne(
    { slug, "pools.id": pool.id },
    {
      $push: {
        "pools.$.clusters": {
          id: "0",
          orgCode: "0",
          organizationName: "Rofyt platform",
          adminEmail: "",
          phone: "",
          database,
          isPlatform: true,
          createdAt: new Date(),
          emailSentAt: null,
        },
      },
    } as never,
  );
}
