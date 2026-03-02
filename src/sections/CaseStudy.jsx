import Accordion from "../components/Accordion.jsx";

const accordionItems = [
  {
    title: "Color layering",
    content:
      "Macro gradients reveal micro-detail callouts using the focus ring token, mirroring Iris Aperture logic."
  },
  {
    title: "Process transparency",
    content:
      "Each case study shows annotated steps with collaborative thread connectors referencing the hero timeline."
  },
  {
    title: "Accessibility guardrails",
    content:
      "Metrics cards pair Slate Ink text on Soft Lilac backgrounds to maintain AA+ contrast."
  }
];

function CaseStudy() {
  return (
    <section id="case-study" className="eye-grid case-study">
      <div className="case-intro">
        <p className="eyebrow">Case study detail</p>
        <h2>Guided partnership through visible craft.</h2>
        <p>
          Each engagement reveals process layers—macro narrative paired with micro-detail annotations
          using the EyeLine grid for predictable rhythm.
        </p>
      </div>
      <div className="case-details">
        <div className="metrics">
          <div>
            <span className="metric">+20%</span>
            <p>Projected lift in inbound conversions after relaunch.</p>
          </div>
          <div>
            <span className="metric">30%</span>
            <p>Faster proposal turnaround using shared templates.</p>
          </div>
        </div>
        <Accordion items={accordionItems} />
      </div>
    </section>
  );
}

export default CaseStudy;
