<?php

declare(strict_types=1);

namespace App\CreateFlat\Application;

use App\CreateFlat\Domain\Flat\FlatFactory;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class CreateFlatHandler
{
    public function __construct(private FlatFactory $flatFactory)
    {
    }

    public function __invoke(CreateFlatCommand $command): void
    {
        $this->flatFactory->create($command->flatId, $command->ownerId, $command->address, $command->rooms);
    }
}
