import PropTypes from "prop-types";

function CTACluster({ primary, secondary }) {
  return (
    <div className="cta-cluster">
      <a className="cta primary" href={primary.href}>
        {primary.label}
      </a>
      <a className="cta secondary" href={secondary.href}>
        {secondary.label}
      </a>
    </div>
  );
}

CTACluster.propTypes = {
  primary: PropTypes.shape({
    label: PropTypes.string.isRequired,
    href: PropTypes.string.isRequired
  }).isRequired,
  secondary: PropTypes.shape({
    label: PropTypes.string.isRequired,
    href: PropTypes.string.isRequired
  }).isRequired
};

export default CTACluster;
