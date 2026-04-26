import os

from dotenv import load_dotenv
from uagents_core.identity import Identity

load_dotenv()

PROBLEM_SEED = os.environ["PROBLEM_AGENT_SEED"]
MARKET_SEED = os.environ["MARKET_AGENT_SEED"]
MONETIZATION_SEED = os.environ["MONETIZATION_AGENT_SEED"]
TECH_SEED = os.environ["TECH_AGENT_SEED"]
ORCHESTRATOR_SEED = os.environ["ORCHESTRATOR_SEED"]

PROBLEM_ADDRESS = Identity.from_seed(PROBLEM_SEED, 0).address
MARKET_ADDRESS = Identity.from_seed(MARKET_SEED, 0).address
MONETIZATION_ADDRESS = Identity.from_seed(MONETIZATION_SEED, 0).address
TECH_ADDRESS = Identity.from_seed(TECH_SEED, 0).address
