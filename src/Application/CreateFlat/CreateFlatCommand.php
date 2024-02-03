<?php

declare(strict_types=1);

namespace App\Application\CreateFlat;

use App\Domain\Flat\FlatId;
use App\Domain\User\UserId;
use App\Shared\SyncMessageInterface;

final readonly class CreateFlatCommand implements SyncMessageInterface
{
    public function __construct(public FlatId $flatId, public UserId $ownerId)
    {
    }
}
