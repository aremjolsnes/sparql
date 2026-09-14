import type { Metadata } from "next";
import "./fuseki-test.css";

export const metadata: Metadata = {
  title: "Fuseki-test — GraphDB vs Jena Fuseki",
  description:
    "Kjør en SPARQL-spørring mot begge endepunkter og sammenlign ytelse, responstid og responsinnhold.",
};

export default function FusekiTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fuseki-test">{children}</div>;
}
