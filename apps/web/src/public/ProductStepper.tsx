import RouteLink from "../components/RouteLink";
import { stepperItems, type ProductStepKey } from "../routes";
import { getStepDotStyle, stepperStyle } from "../styles";
import type { NavigateHandler } from "../viewTypes";

function ProductStepper({
  activeStep,
  onNavigate
}: {
  activeStep: ProductStepKey | null;
  onNavigate: NavigateHandler;
}) {
  const activeIndex = activeStep ? stepperItems.findIndex((item) => item.key === activeStep) : -1;

  return (
    <nav className={stepperStyle} aria-label="Product flow">
      {stepperItems.map((item, index) => {
        const isActive = item.key === activeStep;
        const state = index < activeIndex ? "complete" : isActive ? "active" : "queued";

        return (
          <RouteLink
            current={isActive}
            key={item.key}
            onNavigate={onNavigate}
            to={item.path}
            variant="step"
          >
            <span className={getStepDotStyle(state)}>{index + 1}</span>
            <span>{item.label}</span>
          </RouteLink>
        );
      })}
    </nav>
  );
}

export default ProductStepper;
