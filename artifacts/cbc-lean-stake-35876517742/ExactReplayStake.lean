import Rchain.Casper.Stake

namespace AriaReplay
def bill_kunj_bonds : Rchain.Bonds := [(0, 70), (1, 10), (2, 10), (3, 10)]
def bill_kunj_support : Rchain.SupportMap := [(0, [(0, [0, 1, 2, 3]), (1, [0, 1, 2, 3]), (2, [0, 1, 2, 3])]), (1, [(0, [0]), (1, [1]), (2, [2])]), (2, [(0, [0]), (1, [1]), (2, [2])])]
theorem bill_kunj_stake : Rchain.fullPartitionStake bill_kunj_support bill_kunj_bonds = 70 := by decide
#print axioms bill_kunj_stake
theorem bill_kunj_total : Rchain.totalStake bill_kunj_bonds = 100 := by decide
#print axioms bill_kunj_total
theorem bill_kunj_gate : Rchain.calculateFringe bill_kunj_support bill_kunj_bonds = true := by decide
#print axioms bill_kunj_gate
def community_bonds : Rchain.Bonds := [(0, 70), (1, 10), (2, 10), (3, 10)]
def community_support : Rchain.SupportMap := [(0, [(0, [0, 1, 2, 3]), (1, [0, 1, 2, 3]), (2, [0, 1, 2, 3])]), (1, [(0, [0]), (1, [1]), (2, [2])]), (2, [(0, [0]), (1, [1]), (2, [2])])]
theorem community_stake : Rchain.fullPartitionStake community_support community_bonds = 70 := by decide
#print axioms community_stake
theorem community_total : Rchain.totalStake community_bonds = 100 := by decide
#print axioms community_total
theorem community_gate : Rchain.calculateFringe community_support community_bonds = true := by decide
#print axioms community_gate
def nzpr_bonds : Rchain.Bonds := [(0, 70), (1, 10), (2, 10), (3, 10)]
def nzpr_support : Rchain.SupportMap := [(0, [(0, [0, 1, 2, 3]), (1, [0, 1, 2, 3]), (2, [0, 1, 2, 3])]), (1, [(0, [0]), (1, [1]), (2, [2])]), (2, [(0, [0]), (1, [1]), (2, [2])])]
theorem nzpr_stake : Rchain.fullPartitionStake nzpr_support nzpr_bonds = 70 := by decide
#print axioms nzpr_stake
theorem nzpr_total : Rchain.totalStake nzpr_bonds = 100 := by decide
#print axioms nzpr_total
theorem nzpr_gate : Rchain.calculateFringe nzpr_support nzpr_bonds = true := by decide
#print axioms nzpr_gate
def shplarggle_bonds : Rchain.Bonds := [(0, 70), (1, 10), (2, 10), (3, 10)]
def shplarggle_support : Rchain.SupportMap := [(0, [(0, [0, 1, 2, 3]), (1, [0, 1, 2, 3]), (2, [0, 1, 2, 3])]), (1, [(0, [0]), (1, [1]), (2, [2])]), (2, [(0, [0]), (1, [1]), (2, [2])])]
theorem shplarggle_stake : Rchain.fullPartitionStake shplarggle_support shplarggle_bonds = 70 := by decide
#print axioms shplarggle_stake
theorem shplarggle_total : Rchain.totalStake shplarggle_bonds = 100 := by decide
#print axioms shplarggle_total
theorem shplarggle_gate : Rchain.calculateFringe shplarggle_support shplarggle_bonds = true := by decide
#print axioms shplarggle_gate
end AriaReplay
