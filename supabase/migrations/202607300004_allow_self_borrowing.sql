-- Self-borrowing is a supported tracking use case. Preserve every other
-- membership, creator, household, lifecycle, and permission check in the
-- existing shared-borrow validation trigger.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.validate_household_borrow_transactions()'::regprocedure
  ) into function_definition;

  if position(
    'owner_id is null or borrower_id is null or owner_id = borrower_id'
    in function_definition
  ) > 0 then
    function_definition := replace(
      function_definition,
      'owner_id is null or borrower_id is null or owner_id = borrower_id',
      'owner_id is null or borrower_id is null'
    );
    function_definition := replace(
      function_definition,
      'Borrow owner and borrower must be different active members',
      'Borrow owner and borrower must be active members'
    );
    execute function_definition;
  end if;
end;
$$;
