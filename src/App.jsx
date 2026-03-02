import Hero from "./sections/Hero.jsx";
import CaseStudy from "./sections/CaseStudy.jsx";
import LayoutContainer from "./components/LayoutContainer.jsx";

function App() {
  return (
    <LayoutContainer>
      <Hero />
      <CaseStudy />
    </LayoutContainer>
  );
}

export default App;
