import { Suspense } from "react";
import { connection } from "next/server";
import { readDB } from "@/lib/db";
import { CopaHosteriaApp } from "@/components/CopaHosteriaApp";

async function TournamentLoader() {
  await connection();
  const initialDB = readDB();
  return <CopaHosteriaApp initialDB={initialDB} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#0F2557] text-[#F0C46B] font-bold">
          Cargando Copa Hostería...
        </div>
      }
    >
      <TournamentLoader />
    </Suspense>
  );
}
