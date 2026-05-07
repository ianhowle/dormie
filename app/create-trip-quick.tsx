// =============================================================
// Quick Trip wizard — route entry
// =============================================================
// Mounts the WizardProvider (Context + reducer) and the WizardLayout
// (header + step container + Back/Next footer). The StepRouter switches
// on state.step to render the right step component.
//
// Phase 2.0 ships the scaffolding only — all step content is
// placeholder. Real per-step content lands in 2.1–2.8 by rewriting
// each step file in place.
//
// Wiring note: the legacy /create-trip route stays untouched (called
// from Trips tab "+", Discover destinations, EmptyStates CTA, etc.)
// and will be retired in Phase 2.9. For Phase 2.0 testing, reach this
// route via the dev preview button in Profile → Developer.
// =============================================================

import { WizardProvider, useWizard } from '../src/components/wizard/quick-trip/WizardContext';
import { WizardLayout } from '../src/components/wizard/quick-trip/WizardLayout';
import { Step0Persona } from '../src/components/wizard/quick-trip/steps/Step0Persona';
import { Step1Where } from '../src/components/wizard/quick-trip/steps/Step1Where';
import { Step2When } from '../src/components/wizard/quick-trip/steps/Step2When';
import { Step3Who } from '../src/components/wizard/quick-trip/steps/Step3Who';
import { Step4How } from '../src/components/wizard/quick-trip/steps/Step4How';
import { Step5SideGames } from '../src/components/wizard/quick-trip/steps/Step5SideGames';
import { Step6Stakes } from '../src/components/wizard/quick-trip/steps/Step6Stakes';
import { Step7Confirm } from '../src/components/wizard/quick-trip/steps/Step7Confirm';

function StepRouter() {
  const { state } = useWizard();
  switch (state.step) {
    case 0:
      return <Step0Persona />;
    case 1:
      return <Step1Where />;
    case 2:
      return <Step2When />;
    case 3:
      return <Step3Who />;
    case 4:
      return <Step4How />;
    case 5:
      return <Step5SideGames />;
    case 6:
      return <Step6Stakes />;
    case 7:
      return <Step7Confirm />;
    default:
      return null;
  }
}

export default function CreateTripQuickScreen() {
  return (
    <WizardProvider>
      <WizardLayout>
        <StepRouter />
      </WizardLayout>
    </WizardProvider>
  );
}
