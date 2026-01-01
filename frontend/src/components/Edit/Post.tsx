"use client";
import { useManageStore, BlueRitoLabelAutoPostWithRkey } from "@/lib/ManageStore";
import { useXrpcAgentStore } from "@/lib/XrpcAgent";
import {
  Button,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Textarea
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Save, Trash2 } from 'lucide-react';
import { ActorIdentifier } from '@atcute/lexicons';
import * as TID from '@atcute/tid';
import { useTranslations } from 'next-intl';
import { useState } from "react";

type LabelAction = 'add' | 'remove';
type AppliedTo = 'post' | 'account';

interface ManageFormValues {
  label: string;
  appliedTo: AppliedTo;
  condition: string;
  durationInHours: number;
  action: LabelAction;
}

interface PostFormProps {
  prev?: BlueRitoLabelAutoPostWithRkey | undefined
  close: () => void;
}

export default function PostForm({
  prev,
  close,
}: PostFormProps) {
  const t = useTranslations('console.manage.post');
  const thisClient = useXrpcAgentStore(state => state.thisClient);
  const activeDid = useXrpcAgentStore(state => state.activeDid);
  const labelerDef = useManageStore(state => state.labelerDef);
  const post = useManageStore(state => state.post);
  const setPost = useManageStore(state => state.setPost);
  const labelerVersion = useManageStore(state => state.labelerVersion);
  const [isLoading, setIsLoading] = useState(false);

  const labelOptions = (labelerDef?.policies?.labelValueDefinitions ?? []).map(
    (def) => {
      const ja = def.locales?.find(l => l.lang === 'ja');

      return {
        value: def.identifier,
        label: `[${def.identifier}] ${ja?.name ?? def.identifier}`,
      };
    }
  );

  const form = useForm<ManageFormValues>({
    initialValues: {
      label: prev?.label || '',
      appliedTo: (prev?.appliedTo || 'account') as AppliedTo,
      condition: prev?.condition || '',
      durationInHours: prev?.durationInHours || 0,
      action: 'add',
    },
    validate: {
      label: (v) => (!v ? 'Required' : null),
      condition: (v) => {
        if (!v) return 'Required';
        try {
          new RegExp(v);
          return null; // 正しい正規表現
        } catch  {
          return 'Invalid regular expression';
        }
      },
      durationInHours: (v) =>
        v === null || v === undefined ? 'Required' : null,
    },
  });

  const save = async () => {
    if (form.validate().hasErrors) return
    setIsLoading(true)
    const postLocal = [...post];

    const writes = []
    const value = {
      $type: "blue.rito.label.auto.post" as const,
      label: form.values.label || '',
      appliedTo: form.values.appliedTo || '',
      condition: form.values.condition || '',
      durationInHours: form.values.durationInHours,
      ...(form.values.appliedTo === 'account'
        ? { action: form.values.action }
        : {}),
    };

    if (!prev?.rkey) {
      const rkeyLocal = TID.now();
      const now = new Date().toISOString();

      writes.push({
        $type: "com.atproto.repo.applyWrites#create" as const,
        collection: "blue.rito.label.auto.post" as `${string}.${string}.${string}.${string}.${string}`,
        rkey: rkeyLocal,
        value: {
          createdAt: now,
          ...value,
        },
      });

      const postObj = {
        ...value,
        createdAt: now,
        rkey: rkeyLocal,
      };
      postLocal.push(postObj)
    } else {

      writes.push({
        $type: "com.atproto.repo.applyWrites#update" as const,
        collection: "blue.rito.label.auto.post" as `${string}.${string}.${string}.${string}.${string}`,
        rkey: prev?.rkey,
        value: {
          ...value,
        },
      });

      const postObj = {
        ...value,
        createdAt: prev?.createdAt,
        rkey: prev?.rkey,
      };
      const index = postLocal.findIndex(p => p.rkey === prev?.rkey);

      if (index >= 0) {
        // 同じ rkey が存在すれば上書き
        postLocal[index] = postObj;
      }

    }

    const ret = await thisClient.post('com.atproto.repo.applyWrites', {
      input: {
        repo: activeDid as ActorIdentifier,
        writes: writes
      }
    })

    if (!ret.ok) {
      console.error(ret.data.message)
      setIsLoading(false)
      return
    }

    setPost(postLocal)
    setIsLoading(false)
    close()
  }

  const remove = async () => {
    setIsLoading(true)


    const writes = []
    writes.push({
      $type: "com.atproto.repo.applyWrites#delete" as const,
      collection: "blue.rito.label.auto.post" as `${string}.${string}.${string}.${string}.${string}`,
      rkey: prev?.rkey || ''
    })

    try {
      await thisClient.post('com.atproto.repo.applyWrites', {
        input: {
          repo: activeDid as ActorIdentifier,
          writes
        }
      });
    } catch {

    }

    const postLocal = [...post];
    if (prev?.rkey) {
      const updatedPost = postLocal.filter(p => p.rkey !== prev.rkey);
      setPost(updatedPost);
    }
    setIsLoading(false)
    close()
  }

  return (
    <form onSubmit={form.onSubmit(console.log)}>
      <Stack gap="md">

        {/* 操作するラベル */}
        <Select
          label={t('field.label.title')}
          description={t('field.label.description')}
          data={labelOptions}
          styles={{ input: { fontSize: 16 } }}
          {...form.getInputProps('label')}
        />

        {/* 適用先 */}
        <Radio.Group
          label={t('field.appliedTo.title')}
          description={t('field.appliedTo.description')}
          {...form.getInputProps('appliedTo')}
        >
          <Group mt="xs">
            <Radio value="account" label={t('field.appliedTo.account')} />
            <Radio value="post" label={t('field.appliedTo.post')} />
          </Group>
        </Radio.Group>

        {/* 条件 */}
        <Textarea
          label={t('field.condition.title')}
          description={t('field.condition.description')}
          placeholder={t('field.condition.placeholder')}
          autosize
          minRows={2}
          styles={{ input: { fontSize: 16 } }}
          {...form.getInputProps('condition')}
        />


        {form.values.appliedTo === 'account' &&
          <>
            {/* 操作 */}
            <Radio.Group
              label={t('field.action.title')}
              description={t('field.action.description')}
              {...form.getInputProps('action')}
            >
              <Group mt="xs">
                <Radio value="add" label={t('field.action.add')} />
                <Radio value="remove" label={t('field.action.remove')} />
              </Group>
            </Radio.Group>
          </>
        }

        {(form.values.action === 'add' && labelerVersion.startsWith('0.1.')) &&
          <>
            {/* 有効期限 */}
            <NumberInput
              label={t('field.durationInHours.title')}
              description={t('field.durationInHours.description')}
              min={0}
              clampBehavior="strict"
              styles={{ input: { fontSize: 16 } }}
              {...form.getInputProps('durationInHours')}
            />
          </>
        }

        <Group
          justify={prev ? 'space-between' : 'flex-end'}
          mt="md"
        >
          {prev && (
            <Button
              onClick={() => {
                if (!confirm(t('info.deleteConfirm'))) return;
                remove();
              }}
              color="red"
              loading={isLoading}
              disabled={isLoading}
              leftSection={<Trash2 />}
            >
              {t('button.delete')}
            </Button>
          )}

          <Button onClick={save} loading={isLoading} disabled={isLoading} leftSection={<Save />}>
            {t('button.save')}
          </Button>
        </Group>

      </Stack>
    </form>
  );
}