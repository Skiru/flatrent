<?php

declare(strict_types=1);

namespace App\Application\CreateFlat;

use App\Domain\Flat\FlatFactory;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
final readonly class CreateFlatHandler
{
    public function __construct(private FlatFactory $flatFactory)
    {
    }

    public function __invoke(CreateFlatCommand $command): void
    {
        $flat = $this->flatFactory->create($command->flatId, $command->ownerId);
    }
}
