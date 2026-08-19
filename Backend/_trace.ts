import { prisma } from './src/lib/prisma';
import { SubscriptionService } from './src/modules/subscription/subscription.service';

(async () => {
  const config = await prisma.billingConfig.findUnique({ where: { id: 'default' } });
  const tiers = SubscriptionService.parseEmployeeTiers(config?.employeeTiers);

  const tenant = await prisma.tenant.findFirst({
    where: { name: 'salon wadii' },
    select: {
      id: true, name: true, employeesPaid: true, amountPaidThisPeriod: true, salonCovered: true,
      _count: { select: { employees: { where: { isActive: true } } } },
    },
  });
  console.log('Tenant:', JSON.stringify(tenant, null, 2));
  console.log('Tiers:', JSON.stringify(tiers, null, 2));

  const count = tenant._count.employees;
  const freeThreshold = config.freeEmployeeThreshold;
  const totalBillable = Math.max(0, count - freeThreshold);
  const amountPaid = tenant.amountPaidThisPeriod;
  const tierPrice = totalBillable > 0 && tiers ? SubscriptionService.findTierPrice(totalBillable, tiers) : (config.pricePerEmployee ?? 100);
  const totalMonthly = totalBillable * tierPrice;
  const covered = Math.min(totalBillable, Math.floor(amountPaid / tierPrice));
  const billableEmployees = totalBillable - covered;

  console.log(`\nCalculation:`);
  console.log(`  count=${count}, freeThreshold=${freeThreshold}, totalBillable=${totalBillable}`);
  console.log(`  amountPaid=${amountPaid}`);
  console.log(`  tierPrice (for ${totalBillable} billable emp) = ${tierPrice}`);
  console.log(`  totalMonthly = ${totalBillable} × ${tierPrice} = ${totalMonthly}`);
  console.log(`  covered = floor(${amountPaid}/${tierPrice}) = ${covered}`);
  console.log(`  billableEmployees = ${totalBillable} - ${covered} = ${billableEmployees}`);
  console.log(`  employeeFee = ${totalMonthly} - ${amountPaid} = ${totalMonthly - amountPaid}`);

  await prisma.$disconnect();
})();
