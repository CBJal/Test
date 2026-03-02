import { useState } from "react";
import PropTypes from "prop-types";

function Accordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="accordion">
      {items.map((item, index) => (
        <section key={item.title}>
          <button
            type="button"
            onClick={() => setOpenIndex(index === openIndex ? -1 : index)}
            aria-expanded={index === openIndex}
          >
            <span>{item.title}</span>
            <span>{index === openIndex ? "−" : "+"}</span>
          </button>
          {index === openIndex && <p>{item.content}</p>}
        </section>
      ))}
    </div>
  );
}

Accordion.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      content: PropTypes.string.isRequired
    })
  ).isRequired
};

export default Accordion;
