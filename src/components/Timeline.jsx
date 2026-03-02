import PropTypes from "prop-types";

function Timeline({ steps }) {
  return (
    <ol className="timeline">
      {steps.map((step) => (
        <li key={step.title}>
          <span className="timeline-step">{step.step}</span>
          <div>
            <h4>{step.title}</h4>
            <p>{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

Timeline.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      step: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      detail: PropTypes.string.isRequired
    })
  ).isRequired
};

export default Timeline;
