"""WebTestPilot injected-bug evaluation for autonomously generated Playwright suites.

Outer-evaluator only. Nothing in this package may be exposed to the generation
agent's workspace: it knows about benchmark bugs, ground truth, and expectations.
"""

from general_agent_eval.webtestpilot.apps import APPS, AppSpec

__all__ = ["APPS", "AppSpec"]
