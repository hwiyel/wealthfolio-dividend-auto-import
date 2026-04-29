/**
 * Settings.tsx — Dividend Assistant Settings
 *
 * Allows users to configure tax-exempt accounts for dividend imports.
 */

import React, { useState, useEffect } from 'react';
import type { AddonContext } from '@wealthfolio/addon-sdk';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Icons,
  Page,
  PageContent,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@wealthfolio/ui';

const STORAGE_KEY = 'dividend-assistant-tax-exempt-accounts';

interface SettingsProps {
  ctx: AddonContext;
}

function SettingsPage({ ctx }: SettingsProps) {
  const [taxExemptAccountIds, setTaxExemptAccountIds] = useState<Set<string>>(new Set());
  const [accounts, setAccounts] = useState<any[]>([]);

  // Load accounts
  useEffect(() => {
    ctx.api.accounts.getAll().then((accs) => {
      setAccounts(accs);
    });
  }, [ctx]);

  // Load saved settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setTaxExemptAccountIds(new Set(parsed));
      }
    } catch (error) {
      ctx.api.logger.error('Failed to load tax-exempt settings: ' + String(error));
    }
  }, []);

  // Save settings when changed
  const handleToggleAccount = (accountId: string, checked: boolean) => {
    const newSet = new Set(taxExemptAccountIds);
    if (checked) {
      newSet.add(accountId);
    } else {
      newSet.delete(accountId);
    }
    setTaxExemptAccountIds(newSet);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newSet]));
      ctx.api.logger.info('Tax-exempt accounts updated: ' + JSON.stringify([...newSet]));
    } catch (error) {
      ctx.api.logger.error('Failed to save tax-exempt settings: ' + String(error));
    }
  };

  const header = (
    <PageHeader
      heading="Dividend Assistant Settings"
      text="Configure tax-exempt accounts for dividend imports."
      actions={
        <Button
          variant="outline"
          onClick={() => ctx.api.navigation.navigate('/addons/dividend-assistant')}
        >
          <Icons.ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      }
    />
  );

  return (
    <Page>
      {header}
      <PageContent className="max-w-2xl">
        <div className="flex w-full flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax-Exempt Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select accounts that are tax-exempt (e.g., ISA, retirement accounts). 
                  Dividends imported for these accounts will have tax set to 0.
                </p>
                
                {accounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4">
                    No accounts found. Please create an account first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        onClick={() => handleToggleAccount(account.id, !taxExemptAccountIds.has(account.id))}
                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                            id={`account-${account.id}`}
                            checked={taxExemptAccountIds.has(account.id)}
                            onCheckedChange={(checked) => handleToggleAccount(account.id, checked as boolean)}
                          />
                          <label
                            htmlFor={`account-${account.id}`}
                            className="cursor-pointer font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {account.name}
                          </label>
                        {taxExemptAccountIds.has(account.id) && (
                          <Badge variant="secondary">Tax-Exempt</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {taxExemptAccountIds.size > 0 && (
                  <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    <p className="text-sm">
                      <strong>{taxExemptAccountIds.size}</strong> tax-exempt account(s) configured.
                      Dividends for these accounts will be imported with 0 tax.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}

export default SettingsPage;
