import CTACluster from "../components/CTACluster.jsx";
import Timeline from "../components/Timeline.jsx";

const timelineSteps = [
  { step: "01", title: "Immersion", detail: "Joint workshop to map goals and color cues." },
  { step: "02", title: "Detail Drafts", detail: "Visual explorations with eye-line annotations." },
  { step: "03", title: "Calibration", detail: "Co-review sessions to tune grid + palette." },
  { step: "04", title: "Launch Prep", detail: "Finalize templates and dev handoff package." }
];

function Hero() {
  return (
    <section className="eye-grid hero">
      <div className="hero-content">
        <p className="eyebrow">Witteveen · Eye for detail</p>
        <h1>Approachable creativity with meticulous focus.</h1>
        <p className="supporting">
          We transform every collaboration into a guided experience—combining color mastery, process
          transparency, and a modern system that scales.
        </p>
        <CTACluster
          primary={{ label: "Start a collaborative brief", href: "#contact" }}
          secondary={{ label: "See how we work", href: "#case-study" }}
        />
      </div>
      <div className="hero-timeline">
        <Timeline steps={timelineSteps} />
      </div>
    </section>
  );
}

export default Hero;
