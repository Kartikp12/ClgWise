
import Head from "next/head";
import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/home/Hero";
import getAdmissionStats from "@/lib/data/admissions/getAdmissionStats";

export function getStaticProps() {
  const datasetStats = getAdmissionStats();

  return {
    props: {
      datasetStats,
    },
  };
}

export default function Home({ datasetStats }) {
  return (
    <>
      <Head>
        <title>ClgWise | AI-Powered College Discovery</title>
        <meta
          name="description"
          content="Discover Maharashtra engineering colleges with AI-powered admission insights and official CET Cell cutoff data."
        />
      </Head>

      <main className="min-h-screen bg-[#101820]">
        <Navbar />
        <Hero stats={datasetStats} />
      </main>
    </>
  );
}
