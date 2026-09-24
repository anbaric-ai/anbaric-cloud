/* Tenants keep their data in shared Postgres clusters that live outside the
   cell, so the cell needs a route to them. Peering rather than putting the
   clusters in the cell: the control plane creates a tenant's database over SQL
   during signup, which it can only do if it can reach the cluster itself.

   Same account and region, so the peering accepts itself. Left unset - the
   self-hosted case, where the database is wherever the operator points it -
   nothing here is created. */

resource "aws_vpc_peering_connection" "databases" {
  count       = var.peer_vpc_id == "" ? 0 : 1
  vpc_id      = aws_vpc.anbaric.id
  peer_vpc_id = var.peer_vpc_id
  auto_accept = true

  tags = { Name = "anbaric-${var.name}-databases" }
}
